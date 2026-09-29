import { cachedPlayerRequest, playerCacheKey } from './playerCache'
export interface Player { account_id?: number; personaname?: string; avatarfull?: string; profileurl?: string; rank_tier?: number; profile?: Player }
export interface HeroStat { hero_id: number; games: number; win: number; last_played?: number }
export interface RecentMatch { match_id: number; hero_id: number; game_mode?: number; start_time: number; duration: number; kills: number; deaths: number; assists: number; player_slot: number; radiant_win: boolean }
export interface MatchPlayer { account_id?: number; personaname?: string; player_slot: number; hero_id: number; kills: number; deaths: number; assists: number; gold_per_min: number; xp_per_min: number; net_worth?: number; hero_damage?: number; tower_damage?: number; last_hits?: number; gold_t?: number[]; xp_t?: number[]; lh_t?: number[]; lane_efficiency?: number; lane_role?: number; purchase_log?: { time: number; key: string }[]; kills_log?: { time: number; key: string }[]; deaths_log?: { time: number; key: string }[]; obs_log?: { time: number }[]; sen_log?: { time: number }[]; teamfight_participation?: number; level?: number; denies?: number; hero_healing?: number; item_0?: number; item_1?: number; item_2?: number; item_3?: number; item_4?: number; item_5?: number }
export interface Objective { time: number; type: string; key?: string; slot?: number; player_slot?: number; team?: number }
export interface TeamfightPlayer { deaths?: number; damage?: number; healing?: number; gold_delta?: number; xp_delta?: number; ability_uses?: Record<string, number>; item_uses?: Record<string, number>; deaths_pos?: Record<string, Record<string, number>>; buybacks?: number }
export interface Teamfight { start: number; end: number; radiant_gold_delta?: number; radiant_xp_delta?: number; players?: TeamfightPlayer[] }
export interface Match { match_id: number; radiant_win: boolean; radiant_score: number; dire_score: number; start_time: number; duration: number; game_mode?: number; version?: number; players: MatchPlayer[]; objectives?: Objective[]; teamfights?: Teamfight[]; radiant_gold_adv?: number[]; radiant_xp_adv?: number[]; chat?: { time: number; type: string; key?: string; slot?: number }[]; replay_url?: string; picks_bans?: { is_pick: boolean; hero_id: number; team: number; order: number }[] }
export interface Event { id: string; time: number; type: 'fight' | 'objective' | 'kill' | 'item' | 'system'; title: string; detail: string; side?: 'radiant' | 'dire'; playerSlot?: number; itemKey?: string; impact?: number }

const OPEN_DOTA_API = 'https://api.opendota.com/api'
const api = async <T>(url: string): Promise<T> => {
  let response: Response
  try {
    response = await fetch(`${OPEN_DOTA_API}/${url}`)
  } catch {
    response = await fetch(`/api/opendota/${url}`)
  }
  const data = await response.json().catch(() => ({})) as Record<string, any>
  if (!response.ok) {
    if (response.status === 404) throw Error(url.startsWith('matches/') ? 'OpenDota 尚未收录这场比赛' : '找不到对应的玩家数据')
    throw Error(typeof data?.error === 'string' ? data.error : '获取 OpenDota 数据失败，请稍后重试')
  }
  return data as T
}
export const getPlayer = (id: string) => cachedPlayerRequest(playerCacheKey('profile', id), async () => {
  const [player, wl] = await Promise.all([
    api<{ profile?: Player }>(`players/${id}`),
    api<{ win: number; lose: number }>(`players/${id}/wl`)
  ])
  return { ...player, ...wl }
})
export const getHeroes = (id: string, mode?: string) => cachedPlayerRequest(playerCacheKey('heroes', id, mode || ''), () => api<HeroStat[]>(`players/${id}/heroes${mode ? `?game_mode=${mode}` : ''}`))
export const getMatches = (id: string, opts: { limit?: number; offset?: number; game_mode?: string; hero_id?: string; win?: string; included_account_id?: string } = {}) => {
  const query = new URLSearchParams(Object.entries(opts).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString()
  return cachedPlayerRequest(playerCacheKey('matches', id, query), () => api<RecentMatch[]>(`players/${id}/matches?${query}`))
}
export type Peer = { account_id: number; personaname?: string; with_games?: number; with_win?: number; against_games?: number; against_win?: number; last_played?: number }
export const getPeers = (id: string, limit = 50) => cachedPlayerRequest(playerCacheKey('peers', id, `limit=${limit}`), () => api<Peer[]>(`players/${id}/peers?limit=${Math.min(Math.max(limit, 1), 100)}`))
export const getMatch = (id: string) => api<Match>(`matches/${id}`)
export async function requestMatchParse(id: string): Promise<void> {
  const response = await fetch(`/api/opendota/request/${encodeURIComponent(id)}`, { method: 'POST' })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as Record<string, any>
    const message = typeof body?.error === 'string' ? body.error : '提交解析请求失败，请稍后重试'
    console.error('[opendota-request] browser request failed', { matchId: id, status: response.status, message })
    throw new Error(message)
  }
}

export type TrumpetResult = { account_id: string; trumpet_count: number; rules: string; checked_at: string }
export const requestTrumpets = async (accountIds: string[]) => {
  const response = await fetch('/api/trumpets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accountIds }) })
  const data = await response.json().catch(() => ({})) as { results?: TrumpetResult[]; error?: string }
  if (!response.ok) throw Error(data.error || '近期表现检测失败')
  return data.results || []
}

export const heroImage = (id: number) => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroNames[id]?.internal || 'npc_dota_hero_axe'}.png`
import heroData from './heroes.json'
import { itemName, objectiveName } from './locale'
import itemIds from './item-ids.json'
export const heroNames: Record<number, { name: string; internal: string }> = heroData
export const itemKeyById: Record<string, string> = itemIds
export const modes: Record<number, string> = { 1: '全英雄选择', 2: '队长模式', 3: '随机征召', 4: '单一征召', 5: '随机模式', 12: '有限英雄', 15: 'RD 队长模式', 18: 'OMG', 20: '全英雄选择', 22: '天梯匹配', 23: '加速模式', 27: '活动模式' }
export const won = (m: { player_slot: number; radiant_win: boolean }) => (m.player_slot < 128) === m.radiant_win
export const clock = (seconds: number) => `${seconds < 0 ? '-' : ''}${Math.floor(Math.abs(seconds) / 60).toString().padStart(2, '0')}:${Math.floor(Math.abs(seconds) % 60).toString().padStart(2, '0')}`
export const date = (timestamp: number) => new Date(timestamp * 1000).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
export const short = (value: number) => Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)
export const playerName = (p: MatchPlayer) => p.personaname || (p.account_id ? `玩家 ${p.account_id}` : '匿名玩家')
export const modeName = (id?: number) => modes[id || 0] || `模式 ${id ?? '未知'}`
export const normalizeSteamId = (input: string) => { const raw = input.trim(); if (!/^\d{1,20}$/.test(raw)) return null; const n = BigInt(raw); const offset = 76561197960265728n; const account = n >= offset ? n - offset : n; return account > 0n && account <= 4294967295n ? String(account) : null }

const heroByInternal = (key: string) => Object.values(heroNames).find(hero => key === `npc_dota_hero_${hero.internal}`)?.name || key.replace('npc_dota_hero_', '').replaceAll('_', ' ')
export function timeline(match: Match): Event[] {
  const events: Event[] = []
  const slots = [...match.players.filter(p => p.player_slot < 128), ...match.players.filter(p => p.player_slot >= 128)]
  for (const [index, fight] of (match.teamfights || []).entries()) {
    if (fight.start < 0) continue
    const rDeaths = (fight.players || []).slice(0, 5).reduce((n, p) => n + (p.deaths || 0), 0)
    const dDeaths = (fight.players || []).slice(5, 10).reduce((n, p) => n + (p.deaths || 0), 0)
    const rGold = (fight.players || []).slice(0, 5).reduce((n, p) => n + (p.gold_delta || 0), 0)
    const dGold = (fight.players || []).slice(5, 10).reduce((n, p) => n + (p.gold_delta || 0), 0)
    const side = rGold === dGold ? undefined : rGold > dGold ? 'radiant' : 'dire'
    events.push({ id: `fight-${index}`, time: fight.start, type: 'fight', title: '团战爆发', detail: `持续 ${clock(fight.end - fight.start)} · 天辉阵亡 ${rDeaths} / 夜魇阵亡 ${dDeaths} · 团战期间净经济变化：天辉 ${rGold >= 0 ? '+' : ''}${rGold} / 夜魇 ${dGold >= 0 ? '+' : ''}${dGold}`, side, impact: Math.abs(rGold - dGold) })
  }
  for (const [index, objective] of (match.objectives || []).entries()) {
    if (objective.type === 'CHAT_MESSAGE_COURIER_LOST') continue
    const kind = objective.type || ''
    const key = objective.key || ''
    const title = kind === 'building_kill' ? key.includes('tower') ? '防御塔被摧毁' : key.includes('rax') || key.includes('barracks') ? '兵营被摧毁' : '建筑被摧毁' : kind.includes('ROSHAN') || kind.includes('MINIBOSS') ? '肉山 / 地图首领被击杀' : kind.includes('AEGIS') ? '不朽之守护被拾取' : kind.includes('FIRSTBLOOD') ? '一血' : '地图目标事件'
    const player = match.players.find(p => p.player_slot === objective.player_slot)
    const side = kind === 'building_kill' ? key.includes('badguys') ? 'radiant' : key.includes('goodguys') ? 'dire' : undefined : objective.team === 2 ? 'radiant' : objective.team === 3 ? 'dire' : undefined
    events.push({ id: `objective-${index}`, time: objective.time, type: 'objective', title, detail: [key && objectiveName(key), player && playerName(player)].filter(Boolean).join(' · ') || title, side })
  }
  for (const [index, player] of slots.entries()) {
    for (const [killIndex, kill] of (player.kills_log || []).entries()) {
      events.push({ id: `kill-${index}-${killIndex}`, time: kill.time, type: 'kill', title: `${heroNames[player.hero_id]?.name || playerName(player)} 击杀 ${heroByInternal(kill.key)}`, detail: `${playerName(player)} · ${player.player_slot < 128 ? '天辉' : '夜魇'} · 对方英雄 ${heroByInternal(kill.key)}`, side: player.player_slot < 128 ? 'radiant' : 'dire' })
    }
  }
  for (const player of slots) {
    for (const [index, purchase] of (player.purchase_log || []).entries()) {
      if (!Number.isFinite(purchase.time) || typeof purchase.key !== 'string') continue
      events.push({ id: `item-${player.player_slot}-${index}`, time: purchase.time, type: 'item', title: `${playerName(player)} 购买 ${itemName(purchase.key)}`, detail: `${heroNames[player.hero_id]?.name || `英雄 ${player.hero_id}`} · ${itemName(purchase.key)} · 购买记录，不能证明已经合成或使用`, side: player.player_slot < 128 ? 'radiant' : 'dire', playerSlot: player.player_slot, itemKey: purchase.key })
    }
  }
  if (!events.length) events.push({ id: 'start', time: 0, type: 'system', title: '比赛开始', detail: '此场比赛尚无已解析的事件日志。可在 OpenDota 请求解析后重试。' })
  return events.sort((a, b) => a.time - b.time)
}
export function aiEvidence(match: Match) {
  const events = timeline(match).filter(e => e.type !== 'system' && e.type !== 'item')
  const sortedPlayers = [...match.players.filter(p => p.player_slot < 128), ...match.players.filter(p => p.player_slot >= 128)]
  return {
    match_id: match.match_id,
    duration: match.duration,
    winning_side: match.radiant_win ? '天辉' : '夜魇',
    score: `${match.radiant_score}:${match.dire_score}`,
    parsed: Boolean(match.version && events.length),
    players: sortedPlayers.map(p => ({ slot: p.player_slot, name: playerName(p), hero: heroNames[p.hero_id]?.name || `英雄 ${p.hero_id}`, side: p.player_slot < 128 ? '天辉' : '夜魇', kda: `${p.kills}/${p.deaths}/${p.assists}`, gpm: p.gold_per_min, xpm: p.xp_per_min, net_worth: p.net_worth, hero_damage: p.hero_damage, tower_damage: p.tower_damage, teamfight_participation: p.teamfight_participation, death_times: (p.deaths_log || []).map(d => clock(d.time)).slice(0, 25) })),
    gold_advantage_per_minute: (match.radiant_gold_adv || []).filter((_, i) => i % 3 === 0).map((value, i) => ({ minute: i * 3, radiant_advantage: value })),
    teamfights: (match.teamfights || []).map(fight => ({ time: clock(fight.start), duration: clock(fight.end - fight.start), players: (fight.players || []).map((p, i) => ({ slot: sortedPlayers[i]?.player_slot, hero: heroNames[sortedPlayers[i]?.hero_id]?.name, deaths: p.deaths || 0, damage: p.damage || 0, gold_delta: p.gold_delta || 0, xp_delta: p.xp_delta || 0 })) })),
    events: events.slice(0, 180).map(e => ({ time: clock(e.time), type: e.type, title: e.title, detail: e.detail, gold_impact: e.impact }))
  }
}
