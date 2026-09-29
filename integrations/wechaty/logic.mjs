export function validateConfig(env) {
  const id = env.DOTA_ACCOUNT_ID?.trim()
  const room = env.WECHAT_ROOM_NAME?.trim()
  const origin = env.MATCH_SITE_ORIGIN?.trim() || 'https://dota2analysis.pages.dev'
  if (!/^\d{1,10}$/.test(id || '')) throw Error('DOTA_ACCOUNT_ID 必须是 Steam 32 位账号 ID')
  if (!room || room.length > 100) throw Error('WECHAT_ROOM_NAME 必须是明确的群名')
  const url = new URL(origin)
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('MATCH_SITE_ORIGIN 必须是 HTTPS 站点根地址')
  return { id, room, origin: url.origin, interval: 15 * 60_000 }
}
export function selectRoom(rooms, name) {
  const found = rooms.filter(room => room.topic === name)
  if (found.length !== 1) throw Error(`群“${name}”匹配 ${found.length} 个，停止发送`)
  return found[0].room
}
export function newMatches(matches, lastMatchId) {
  const index = matches.findIndex(match => String(match.match_id) === String(lastMatchId))
  if (index < 0) throw Error('上次比赛未出现在最近比赛中；请检查是否漏发，再手动更新状态')
  return matches.slice(0, index).reverse()
}
export function matchText(match, accountId, origin) {
  const radiant = Number(match.player_slot) < 128
  const won = Boolean(match.radiant_win) === radiant
  return `【Dota 2 战绩】账号 ${accountId} ${won ? '胜利' : '失败'}\n英雄 ID：${match.hero_id} · K/D/A ${match.kills}/${match.deaths}/${match.assists}\n复盘：${origin}/matches/${match.match_id}`
}
