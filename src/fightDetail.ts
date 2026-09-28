import { heroNames, playerName, type Match, type TeamfightPlayer } from './data'
import { abilityName, itemName } from './locale'
import { isMajorObjective, minute, objectiveLabel, objectiveSide, sideLabel, sideOf } from './review'

export type FightPosition = { x: number; y: number; slot: number; hero: string; count: number }
export const mapPosition = (x: number, y: number) => ({ left: `${(x - 128) / 127 * 100}%`, top: `${(255 - y) / 127 * 100}%` })

export function fightDetail(match: Match, index: number) {
  const fight = match.teamfights?.[index]
  if (!fight) return undefined
  const players = [...match.players].sort((a, b) => a.player_slot - b.player_slot)
  const participants = players.map((player, i) => {
    const stats: TeamfightPlayer = fight.players?.[i] || {}
    return {
      player, slot: player.player_slot, hero: heroNames[player.hero_id]?.name || `英雄 ${player.hero_id}`,
      name: playerName(player), side: sideOf(player.player_slot), deaths: stats.deaths ?? 0,
      damage: stats.damage ?? 0, healing: stats.healing ?? 0, gold: stats.gold_delta ?? 0,
      xp: stats.xp_delta ?? 0, buybacks: stats.buybacks ?? 0,
      abilities: Object.entries(stats.ability_uses || {}).filter(([, count]) => count > 0).map(([key, count]) => ({ key, name: abilityName(key), count })),
      items: Object.entries(stats.item_uses || {}).filter(([, count]) => count > 0).map(([key, count]) => ({ key, name: itemName(key), count })),
      positions: Object.entries(stats.deaths_pos || {}).flatMap(([x, ys]) => Object.entries(ys).filter(([y, count]) => Number.isInteger(+x) && Number.isInteger(+y) && +x >= 128 && +x <= 255 && +y >= 128 && +y <= 255 && count > 0).map(([y, count]) => ({ x: +x, y: +y, slot: player.player_slot, hero: heroNames[player.hero_id]?.name || `英雄 ${player.hero_id}`, count })))
    }
  })
  const radiant = participants.filter(p => p.side === 'radiant')
  const dire = participants.filter(p => p.side === 'dire')
  const sum = (values: typeof participants, field: 'deaths' | 'gold' | 'xp') => values.reduce((total, p) => total + p[field], 0)
  const objectives = (match.objectives || []).filter(o => isMajorObjective(o) && o.time > fight.end && o.time <= fight.end + 180).map(o => ({ time: minute(o.time), side: objectiveSide(o), label: objectiveLabel(o) }))
  return { index, start: fight.start, end: fight.end, participants, radiant, dire,
    radiantDeaths: sum(radiant, 'deaths'), direDeaths: sum(dire, 'deaths'),
    radiantGold: sum(radiant, 'gold'), direGold: sum(dire, 'gold'),
    radiantXp: sum(radiant, 'xp'), direXp: sum(dire, 'xp'), objectives,
    positions: participants.flatMap(p => p.positions),
    explanation: '死亡坐标只记录已解析的死亡位置；技能/物品次数是使用记录，不表示命中、效果、可见视野或做决定的人。团战后 3 分钟目标只表示时间相邻。'
  }
}

export function fightDetailEvidence(match: Match, index: number) {
  const detail = fightDetail(match, index)
  if (!detail) return undefined
  return {
    start: minute(detail.start), end: minute(detail.end),
    deaths: { radiant: detail.radiantDeaths, dire: detail.direDeaths },
    goldChange: { radiant: detail.radiantGold, dire: detail.direGold },
    xpChange: { radiant: detail.radiantXp, dire: detail.direXp },
    participants: detail.participants.map(p => ({ slot: p.slot, hero: p.hero, name: p.name, side: sideLabel(p.side), deaths: p.deaths, damage: p.damage, healing: p.healing, goldChange: p.gold, xpChange: p.xp, buybacks: p.buybacks, abilitiesUsed: p.abilities.map(a => ({ name: a.name, count: a.count })), itemsUsed: p.items.map(item => ({ name: item.name, count: item.count })), recordedDeathPositions: p.positions.map(({ x, y, count }) => ({ x, y, count })) })),
    objectivesWithin3Minutes: detail.objectives.map(o => ({ ...o, side: o.side && sideLabel(o.side) })),
    interpretation: detail.explanation
  }
}
