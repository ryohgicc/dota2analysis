const kinds: Record<string, string> = { player: 'players', heroes: 'players', wl: 'players', matches: 'players', peers: 'players', match: 'matches' }

type Env = { OPEN_DOTA_API_KEY?: string }
export const onRequestGet: PagesFunction<Env> = async ({ params, request, env }) => {
  const kind = String(params.kind || '')
  const id = String(params.id || '')
  if (!kinds[kind] || !/^\d{1,20}$/.test(id)) return Response.json({ error: '无效的玩家或比赛 ID' }, { status: 400 })
  const path = kind === 'match' ? `matches/${id}` : `players/${id}${kind === 'player' ? '' : `/${kind}`}`
  const incoming = new URL(request.url).searchParams
  const query = new URLSearchParams()
  if (env?.OPEN_DOTA_API_KEY) query.set('api_key', env.OPEN_DOTA_API_KEY)
  if (kind === 'matches') {
    query.set('limit', String(Math.min(Math.max(Number(incoming.get('limit')) || 20, 1), 100)))
    for (const field of ['hero_id', 'game_mode', 'win', 'offset', 'included_account_id']) {
      const value = incoming.get(field)
      if (value !== null && /^\d{1,20}$/.test(value)) query.set(field, value)
    }
  }
  if (kind === 'peers') {
    query.set('limit', String(Math.min(Math.max(Number(incoming.get('limit')) || 50, 1), 100)))
  }
  if (kind === 'heroes') {
    const mode = incoming.get('game_mode')
    if (mode !== null && /^\d{1,20}$/.test(mode)) query.set('game_mode', mode)
  }
  try {
    const upstream = await fetch(`https://api.opendota.com/api/${path}${query.size ? `?${query}` : ''}`, {})
    if (!upstream.ok) return Response.json({ error: upstream.status === 404 ? '找不到对应数据' : `OpenDota 暂时不可用 (${upstream.status})` }, { status: upstream.status === 404 ? 404 : 502 })
    const data = await upstream.json() as { error?: string; players?: unknown[]; version?: number } | null
    if (kind === 'match' && (!data || !Array.isArray(data.players))) return Response.json({ error: 'OpenDota 尚未收录这场比赛' }, { status: 404 })
    if (data?.error) return Response.json({ error: data.error }, { status: 404 })
    const cacheControl = kind === 'match' && !data?.version ? 'no-store' : `public, max-age=${kind === 'match' ? 300 : 90}`
    return Response.json(data, { headers: { 'Cache-Control': cacheControl } })
  } catch { return Response.json({ error: '获取比赛数据失败，请稍后再试' }, { status: 502 }) }
}
