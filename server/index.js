import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { isIP } from 'node:net'
import dns from 'node:dns/promises'
import { createTrumpetChecker } from './trumpets.js'

const app = express()
app.use(express.json({ limit: '180kb' }))
const cache = new Map()
const sharedAnalyses = new Map()
const trumpetChecker = createTrumpetChecker()
const id = value => /^\d{1,20}$/.test(String(value ?? ''))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.get('/api/analyses', (req, res) => {
  const rawLimit = Number(req.query.limit || 20)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 50) : 20
  const analyses = [...sharedAnalyses.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, limit)
  return res.json({ analyses })
})
app.get('/api/analyses/:matchId', (req, res) => {
  const matchId = req.params.matchId
  const scope = req.query.scope || 'whole'
  const fightIndex = scope === 'event' ? Number(req.query.fightIndex) : -1
  if (!id(matchId) || !['whole', 'event'].includes(scope) || scope === 'event' && (!Number.isInteger(fightIndex) || fightIndex < 0)) return res.status(400).json({ error: '分析参数无效' })
  return res.json({ analysis: sharedAnalyses.get(`${matchId}:${scope}:${fightIndex}`) || null })
})
app.post('/api/analyses/:matchId', (req, res) => {
  const matchId = req.params.matchId
  const { scope, fightIndex, content, model } = req.body ?? {}
  const index = scope === 'event' ? Number(fightIndex) : -1
  if (!id(matchId) || !['whole', 'event'].includes(scope) || scope === 'event' && (!Number.isInteger(index) || index < 0) || typeof content !== 'string' || !content.trim() || content.length > 30000 || typeof model !== 'string' || model.length > 100) return res.status(400).json({ error: '分析内容格式不正确' })
  const analysis = { match_id: matchId, scope, fight_index: index, content, model, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  sharedAnalyses.set(`${matchId}:${scope}:${index}`, analysis)
  return res.status(201).json({ analysis })
})
app.post('/api/trumpets', async (req, res) => {
  const accountIds = Array.isArray(req.body?.accountIds) ? [...new Set(req.body.accountIds.filter(value => /^\d{1,20}$/.test(String(value))).map(String))].slice(0, 10) : []
  if (!accountIds.length) return res.status(400).json({ error: '没有有效的玩家账号' })
  try { return res.json({ results: await trumpetChecker(accountIds) }) } catch { return res.status(503).json({ error: '近期表现检测暂时不可用' }) }
})
app.post('/api/opendota/request/:id', async (req, res) => {
  const matchId = req.params.id
  console.info(`[opendota-request] received matchId=${matchId}`)
  if (!id(matchId)) {
    console.warn(`[opendota-request] rejected invalid matchId=${matchId}`)
    return res.status(400).json({ error: '请输入有效的数字比赛 ID' })
  }
  try {
    const upstream = await fetch(`https://api.opendota.com/api/request/${matchId}${process.env.OPEN_DOTA_API_KEY ? `?api_key=${encodeURIComponent(process.env.OPEN_DOTA_API_KEY)}` : ''}`, { method: 'POST', signal: AbortSignal.timeout(15000), redirect: 'error' })
    if (!upstream.ok) {
      const body = (await upstream.text()).slice(0, 300).replaceAll(/\s+/g, ' ')
      console.error(`[opendota-request] upstream failed matchId=${matchId} status=${upstream.status} body=${body || '<empty>'}`)
      return res.status(upstream.status === 429 ? 429 : 502).json({ error: upstream.status === 429 ? 'OpenDota 请求频繁，请稍后再试' : `OpenDota 无法受理解析请求 (${upstream.status})` })
    }
    const result = await upstream.json()
    if (!result || typeof result !== 'object' || result.error) {
      console.error(`[opendota-request] upstream returned unexpected body matchId=${matchId} error=${String(result?.error || '<missing response>')}`)
      return res.status(502).json({ error: 'OpenDota 无法受理解析请求，请稍后再试' })
    }
    cache.delete(`https://api.opendota.com/api/matches/${matchId}`)
    console.info(`[opendota-request] submitted matchId=${matchId} jobId=${result?.job?.jobId ?? result?.jobId ?? '<none>'}`)
    return res.json({ submitted: true, jobId: result?.job?.jobId ?? result?.jobId ?? null })
  } catch (error) {
    console.error(`[opendota-request] exception matchId=${matchId} name=${error?.name || 'Error'} message=${error?.message || String(error)}`)
    return res.status(502).json({ error: '无法提交到 OpenDota，请稍后再试' })
  }
})

app.get('/api/opendota/:kind/:id', async (req, res) => {
  const { kind, id: account } = req.params
  const paths = { player: `players/${account}`, heroes: `players/${account}/heroes`, wl: `players/${account}/wl`, matches: `players/${account}/matches`, peers: `players/${account}/peers`, match: `matches/${account}` }
  if (!(kind in paths) || !id(account)) return res.status(400).json({ error: '无效的玩家或比赛 ID' })
  const query = new URLSearchParams()
  if (kind === 'matches') {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)
    query.set('limit', String(limit))
    for (const key of ['hero_id', 'game_mode', 'win', 'included_account_id']) {
      if (req.query[key] !== undefined && id(req.query[key])) query.set(key, String(req.query[key]))
    }
    if (req.query.offset !== undefined && id(req.query.offset)) query.set('offset', String(req.query.offset))
  }
  if (kind === 'peers') {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100)
    query.set('limit', String(limit))
  }
  if (kind === 'heroes' && req.query.game_mode !== undefined && id(req.query.game_mode)) query.set('game_mode', String(req.query.game_mode))
  if (process.env.OPEN_DOTA_API_KEY) query.set('api_key', process.env.OPEN_DOTA_API_KEY)
  const url = `https://api.opendota.com/api/${paths[kind]}${query.size ? `?${query}` : ''}`
  const existing = cache.get(url)
  if (existing && existing.expires > Date.now()) return res.json(existing.data)
  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!upstream.ok) return res.status(upstream.status === 404 ? 404 : 502).json({ error: upstream.status === 404 ? '找不到对应数据' : `OpenDota 暂时不可用 (${upstream.status})` })
    const data = await upstream.json()
    if (kind === 'match' && (!data || !Array.isArray(data.players))) return res.status(404).json({ error: 'OpenDota 尚未收录这场比赛' })
    if (data?.error) return res.status(404).json({ error: data.error })
    cache.set(url, { data, expires: Date.now() + (kind === 'match' ? 300000 : 90000) })
    if (cache.size > 200) cache.delete(cache.keys().next().value)
    return res.json(data)
  } catch { return res.status(502).json({ error: '获取比赛数据失败，请稍后再试' }) }
})

const isPublicAddress = address => {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number)
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 || a === 192 && b === 0)
  }
  if (isIP(address) === 6) return !/^(::1|::|f[cd]|fe[89ab]|::ffff:)/i.test(address)
  return false
}
const allowedHost = async url => {
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home') || isIP(host)) return false
  const records = await dns.lookup(host, { all: true })
  return records.length > 0 && records.every(record => isPublicAddress(record.address))
}
app.post('/api/analyze', async (req, res) => {
  const { baseUrl, apiKey, model, messages } = req.body ?? {}
  if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 512 || typeof model !== 'string' || !model.trim() || model.length > 100 || !Array.isArray(messages) || messages.length < 1 || messages.length > 3 || messages.some(message => !['system', 'user'].includes(message?.role) || typeof message.content !== 'string' || message.content.length > 45000)) return res.status(400).json({ error: '请检查 AI 配置和比赛数据' })
  let url
  try { url = new URL(baseUrl) } catch { return res.status(400).json({ error: 'Base URL 格式不正确' }) }
  try {
    if (!await allowedHost(url)) return res.status(400).json({ error: 'Base URL 必须是可公开访问的 HTTPS 地址' })
    const endpoint = new URL(`${url.pathname.replace(/\/$/, '')}/chat/completions`, url.origin)
    const upstream = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages, temperature: 0.3 }), signal: AbortSignal.timeout(60000), redirect: 'error' })
    if (!upstream.ok) return res.status(502).json({ error: `模型服务返回 ${upstream.status}` })
    const result = await upstream.json()
    const text = result.choices?.[0]?.message?.content
    if (typeof text !== 'string') return res.status(502).json({ error: '模型没有返回文本' })
    return res.json({ content: text, saved: false })
  } catch (error) { return res.status(502).json({ error: error?.name === 'TimeoutError' ? '模型响应超时' : '连接模型服务失败' }) }
})

const here = dirname(fileURLToPath(import.meta.url))
app.use(express.static(join(here, '../dist')))
app.get('/{*path}', (_req, res) => res.sendFile(join(here, '../dist/index.html')))
const port = Number(process.env.PORT) || 3001
app.listen(port, '127.0.0.1', () => console.log(`API + site: http://127.0.0.1:${port}`))
