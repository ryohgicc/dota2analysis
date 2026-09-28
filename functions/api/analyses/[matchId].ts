type Env = { DB: D1Database }
export const onRequestGet: PagesFunction<Env> = async ({ params, request, env }) => {
  const matchId = String(params.matchId || '')
  const url = new URL(request.url)
  const scope = url.searchParams.get('scope') || 'whole'
  const rawIndex = url.searchParams.get('fightIndex')
  const fightIndex = scope === 'event' && rawIndex !== null && /^\d+$/.test(rawIndex) ? Number(rawIndex) : -1
  if (!/^\d{1,20}$/.test(matchId) || !['whole', 'event'].includes(scope) || scope === 'event' && (!Number.isSafeInteger(fightIndex) || fightIndex < 0)) return Response.json({ error: '分析参数无效' }, { status: 400 })
  try {
    const row = await env.DB.prepare('SELECT match_id, scope, fight_index, content, model, created_at, updated_at FROM analyses WHERE match_id = ? AND scope = ? AND fight_index = ?').bind(matchId, scope, fightIndex).first()
    return Response.json({ analysis: row || null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return Response.json({ error: '共享分析暂时不可用' }, { status: 503 }) }
}
