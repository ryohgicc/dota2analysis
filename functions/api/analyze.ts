type Env = { DB: D1Database }
type Message = { role: 'system' | 'user'; content: string }
type Body = { baseUrl?: unknown; apiKey?: unknown; model?: unknown; messages?: unknown; matchId?: unknown; scope?: unknown; fightIndex?: unknown }
export const validPublicHostname = (hostname: string) => {
  const host = hostname.toLowerCase()
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home')) return false
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false
  if (/^\d+(?:\.\d+){3}$/.test(host) || host.includes(':')) return false
  return true
}
const privateAddress = (address: string) => {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(address)) {
    const [a, b] = address.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && (b === 168 || b === 0) || a === 100 && b >= 64 && b <= 127
  }
  return /^(::1|::|f[cd]|fe[89ab]|::ffff:)/i.test(address)
}
export async function publicHost(hostname: string) {
  const results = await Promise.allSettled(['A', 'AAAA'].map(async type => {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, { headers: { Accept: 'application/dns-json' } })
    if (!response.ok) throw Error('DNS failed')
    return response.json() as Promise<{ Status: number; Answer?: { type: number; data: string }[] }>
  }))
  const answers = results.filter((result): result is PromiseFulfilledResult<{ Status: number; Answer?: { type: number; data: string }[] }> => result.status === 'fulfilled').flatMap(result => result.value.Answer || []).filter(answer => answer.type === 1 || answer.type === 28).map(answer => answer.data)
  if (answers.some(privateAddress)) return false
  return answers.length > 0 || results.every(result => result.status === 'rejected')
}
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (Number(request.headers.get('content-length')) > 180 * 1024) return Response.json({ error: '请检查 AI 配置和比赛数据' }, { status: 413 })
  const payload = await request.text().catch(() => '')
  if (new TextEncoder().encode(payload).byteLength > 180 * 1024) return Response.json({ error: '请检查 AI 配置和比赛数据' }, { status: 413 })
  let body: Body | null = null
  try { body = JSON.parse(payload) as Body } catch { /* Invalid JSON is rejected by the input checks below. */ }
  const { baseUrl, apiKey, model, messages, matchId, scope, fightIndex } = body || {}
  if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 512 || typeof model !== 'string' || !model.trim() || model.length > 100 || !Array.isArray(messages) || messages.length < 1 || messages.length > 3 || messages.some(m => !m || !['system', 'user'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 45000)) return Response.json({ error: '请检查 AI 配置和比赛数据' }, { status: 400 })
  let url: URL
  try { url = new URL(baseUrl as string) } catch { return Response.json({ error: 'Base URL 格式不正确' }, { status: 400 }) }
  try {
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !validPublicHostname(url.hostname) || !await publicHost(url.hostname)) return Response.json({ error: 'Base URL 必须是可公开访问的 HTTPS 地址' }, { status: 400 })
    const endpoint = new URL(`${url.pathname.replace(/\/$/, '')}/chat/completions`, url.origin)
    const upstream = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: messages as Message[], temperature: 0.3 }), signal: AbortSignal.timeout(60000), redirect: 'error' })
    if (!upstream.ok) {
      return Response.json({ error: `模型服务返回 ${upstream.status}` }, { status: 502 })
    }
    const result = await upstream.json() as { choices?: { message?: { content?: unknown } }[] }
    const text = result.choices?.[0]?.message?.content
    if (typeof text !== 'string') return Response.json({ error: '模型没有返回文本' }, { status: 502 })
    let saved = false
    const index = scope === 'event' ? fightIndex : -1
    if (typeof matchId === 'string' && /^\d{1,20}$/.test(matchId) && (scope === 'whole' || scope === 'event' && Number.isInteger(index) && Number(index) >= 0) && text.trim() && text.length <= 30000) {
      try {
        await env.DB.prepare(`INSERT INTO analyses (match_id, scope, fight_index, content, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(match_id, scope, fight_index) DO UPDATE SET content = excluded.content, model = excluded.model, updated_at = CURRENT_TIMESTAMP`).bind(matchId, scope, index, text, model).run()
        saved = true
      } catch { /* The generated answer can still be shown if storage is unavailable. */ }
    }
    return Response.json({ content: text, saved })
  } catch (error) { return Response.json({ error: error instanceof Error && error.name === 'TimeoutError' ? '模型响应超时' : `连接模型服务失败：${error instanceof Error ? error.message.slice(0, 160) : '未知网络错误'}` }, { status: 502 }) }
}
