import type { Match, Objective } from './data'
import { itemName } from './locale'

export type Side = 'radiant' | 'dire'
export const sideOf = (slot: number): Side => slot < 128 ? 'radiant' : 'dire'
export const sideLabel = (side: Side) => side === 'radiant' ? '天辉' : '夜魇'
export const minute = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
export const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('zh-CN')}`

export function objectiveSide(objective: Objective): Side | undefined {
  if (objective.type === 'building_kill') {
    if (objective.key?.includes('badguys')) return 'radiant'
    if (objective.key?.includes('goodguys')) return 'dire'
  }
  if (objective.team === 2) return 'radiant'
  if (objective.team === 3) return 'dire'
  if (objective.player_slot !== undefined) return sideOf(objective.player_slot)
  return undefined
}
export const isMajorObjective = (objective: Objective) => objective.type === 'building_kill' || objective.type === 'CHAT_MESSAGE_ROSHAN_KILL' || objective.type === 'CHAT_MESSAGE_MINIBOSS_KILL'
export const objectiveLabel = (objective: Objective) => objective.type === 'building_kill'
  ? objective.key?.includes('tower') ? '防御塔' : objective.key?.includes('rax') || objective.key?.includes('barracks') ? '兵营' : '建筑'
  : objective.type === 'CHAT_MESSAGE_ROSHAN_KILL' ? '肉山' : '地图首领'

export function goldTurns(match: Match) {
  const gold = match.radiant_gold_adv || []
  const candidates = gold.slice(3).map((after, index) => {
    const endMinute = index + 3
    const startMinute = endMinute - 3
    const before = gold[startMinute]
    return { startMinute, endMinute, before, after, change: after - before }
  }).filter(point => Number.isFinite(point.change))
  const result: typeof candidates = []
  for (const candidate of candidates.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))) {
    if (result.every(other => candidate.endMinute <= other.startMinute || candidate.startMinute >= other.endMinute)) result.push(candidate)
    if (result.length === 3) break
  }
  return result.sort((a, b) => a.startMinute - b.startMinute)
}
export function turnContext(match: Match, startMinute: number, endMinute: number) {
  const start = startMinute * 60
  const end = endMinute * 60
  const fights = (match.teamfights || []).filter(f => f.start >= start && f.start < end).map(f => ({ time: f.start, label: '团战' }))
  const objectives = (match.objectives || []).filter(o => isMajorObjective(o) && o.time >= start && o.time < end).map(o => ({ time: o.time, label: `${objectiveSide(o) ? sideLabel(objectiveSide(o)!) : '阵营未知'}${objectiveLabel(o)}` }))
  return [...fights, ...objectives].sort((a, b) => a.time - b.time)
}
export function laning(match: Match) {
  return [...match.players].sort((a, b) => a.player_slot - b.player_slot).map(p => ({
    player: p,
    gold10: p.gold_t?.[10],
    xp10: p.xp_t?.[10],
    lh10: p.lh_t?.[10],
    laneEfficiency: p.lane_efficiency === undefined || p.lane_efficiency === null ? undefined : Math.round(p.lane_efficiency * 100),
    laneRole: p.lane_role
  }))
}
export function itemMilestones(match: Match) {
  return [...match.players].sort((a, b) => a.player_slot - b.player_slot).map(player => {
    const purchases = (player.purchase_log || []).filter(p => Number.isFinite(p.time) && p.time >= -120 && typeof p.key === 'string' && !/^(tpscroll|ward_|sentry|observer|dust|smoke_of_deceit|clarity|flask|tango|enchanted_mango|faerie_fire|blood_grenade|branches|recipe)/.test(p.key))
    return { player, purchases: purchases.map(p => ({ time: p.time, item: itemName(p.key), key: p.key })) }
  })
}
export function fightReviews(match: Match) {
  return (match.teamfights || []).filter(f => f.start >= 0).map((fight, index) => {
    const players = [...match.players].sort((a, b) => a.player_slot - b.player_slot)
    const radiantDeaths = (fight.players || []).slice(0, 5).reduce((n, p) => n + (p.deaths || 0), 0)
    const direDeaths = (fight.players || []).slice(5, 10).reduce((n, p) => n + (p.deaths || 0), 0)
    const radiantGold = (fight.players || []).slice(0, 5).reduce((n, p) => n + (p.gold_delta || 0), 0)
    const direGold = (fight.players || []).slice(5, 10).reduce((n, p) => n + (p.gold_delta || 0), 0)
    const after = (match.objectives || []).filter(o => isMajorObjective(o) && o.time > fight.end && o.time <= fight.end + 180).map(o => ({ time: o.time, label: objectiveLabel(o), side: objectiveSide(o) }))
    return { index, start: fight.start, end: fight.end, radiantDeaths, direDeaths, radiantGold, direGold, after, participants: (fight.players || []).map((p, i) => ({ player: players[i], deaths: p.deaths || 0, damage: p.damage || 0, goldDelta: p.gold_delta || 0, xpDelta: p.xp_delta || 0 })) }
  })
}
export function coverage(match: Match) {
  return {
    economic: (match.radiant_gold_adv?.length || 0) >= 4,
    laning: match.players.some(p => p.gold_t?.[10] !== undefined),
    purchases: match.players.some(p => (p.purchase_log?.length || 0) > 0),
    fights: (match.teamfights?.length || 0) > 0,
    objectives: (match.objectives || []).some(isMajorObjective),
    wardPlacements: match.players.some(p => (p.obs_log?.length || 0) > 0 || (p.sen_log?.length || 0) > 0),
    replayPositions: false
  }
}
export function reviewEvidence(match: Match) {
  const state = coverage(match)
  return {
    coverage: state,
    interpretation: '经济区间变化与相邻事件只证明时间关联，不能单独证明因果。团战后目标窗口为团战结束后 180 秒；无目标记录不等于错误决策。购买日志是购买时间而非装备完成时间，不证明团战时持有或使用；其中出装采样排除消耗品、卷轴和侦查用品，完整日志在页面时间轴。',
    losingSide: sideLabel(match.radiant_win ? 'dire' : 'radiant'),
    draft: (match.picks_bans || []).map(p => ({ order: p.order, team: sideLabel(p.team === 0 ? 'radiant' : 'dire'), action: p.is_pick ? '选取' : '禁用', hero_id: p.hero_id })),
    turns: goldTurns(match).map(t => ({ ...t, nearbyEvents: turnContext(match, t.startMinute, t.endMinute).map(e => ({ time: minute(e.time), label: e.label })) })),
    laning10: laning(match).map(p => ({ slot: p.player.player_slot, gold: p.gold10, xp: p.xp10, lastHits: p.lh10, efficiencyPercent: p.laneEfficiency, laneRole: p.laneRole })),
    purchasesByPlayer: itemMilestones(match).map(p => {
      const entries = p.purchases
      const sampled = entries.length > 24
        ? entries.filter((_, index) => index < 4 || index >= entries.length - 4 || index % Math.ceil(entries.length / 18) === 0)
        : entries
      return { slot: p.player.player_slot, totalPurchaseEvents: p.player.purchase_log?.length || 0, nonConsumableEvents: entries.length, sampled: entries.length > 24, events: sampled.map(({ key, ...event }) => event) }
    }),
    fights: fightReviews(match).map(f => ({ time: minute(f.start), radiantDeaths: f.radiantDeaths, direDeaths: f.direDeaths, radiantGoldChange: f.radiantGold, direGoldChange: f.direGold, participants: f.participants.map(p => ({ slot: p.player?.player_slot, deaths: p.deaths, damage: p.damage, goldChange: p.goldDelta, xpChange: p.xpDelta })), objectivesWithin3Minutes: f.after.map(o => ({ time: minute(o.time), side: o.side && sideLabel(o.side), label: o.label })) }))
  }
}
