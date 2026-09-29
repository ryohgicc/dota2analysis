import { aiEvidence, timeline, type Match } from './data'
import { reviewEvidence } from './review'
import { fightDetailEvidence } from './fightDetail'

const MAX_EVIDENCE_LENGTH = 12000
const cap = <T,>(items: T[] | undefined, limit: number) => (items || []).slice(0, limit)
const length = (value: unknown) => JSON.stringify(value).length

type Review = ReturnType<typeof reviewEvidence>
type Fight = Review['fights'][number]

function keyFights(fights: Fight[], limit: number) {
  return [...fights].sort((a, b) => Math.abs(b.radiantGoldChange - b.direGoldChange) - Math.abs(a.radiantGoldChange - a.direGoldChange))
    .slice(0, limit).sort((a, b) => a.time.localeCompare(b.time))
}

function compactFight(fight: NonNullable<ReturnType<typeof fightDetailEvidence>>, index: number) {
  return {
    index, start: fight.start, end: fight.end, deaths: fight.deaths,
    goldChange: fight.goldChange, xpChange: fight.xpChange,
    objectivesWithin3Minutes: cap(fight.objectivesWithin3Minutes, 3),
    participants: fight.participants.map(p => ({
      slot: p.slot, deaths: p.deaths, damage: p.damage, healing: p.healing,
      goldChange: p.goldChange, xpChange: p.xpChange,
      abilitiesUsed: cap(p.abilitiesUsed, 2), itemsUsed: cap(p.itemsUsed, 2),
      recordedDeathPositions: cap(p.recordedDeathPositions, 1)
    }))
  }
}

/** Send key changes once, then shrink optional details when the model input exceeds the budget. */
export function buildAnalysisEvidence(match: Match, focusedFightIndex?: number) {
  const base = aiEvidence(match)
  const review = reviewEvidence(match)
  const fullEventCount = timeline(match).filter(e => e.type !== 'system').length
  const focus = focusedFightIndex !== undefined && Number.isInteger(focusedFightIndex)
    ? fightDetailEvidence(match, focusedFightIndex) : undefined
  const objectives = base.events.filter(e => e.type === 'objective')
  const selectedFights = focus ? [] : keyFights(review.fights, 4)
  const keyMinutes = focus
    ? [Number(focus.start.slice(0, 2))]
    : [...review.turns.map(t => t.endMinute), ...selectedFights.map(f => Number(f.time.slice(0, 2)))]

  const purchasesByPlayer = review.purchasesByPlayer.map(p => {
    const purchases = p.events.map((event, index) => ({ event, index, distance: Math.min(...keyMinutes.map(time => Math.abs(time * 60 - event.time)), Infinity) }))
    const closest = purchases.sort((a, b) => a.distance - b.distance).slice(0, 4).sort((a, b) => a.index - b.index)
    return { slot: p.slot, totalPurchaseEvents: p.totalPurchaseEvents, nonConsumableEvents: p.nonConsumableEvents,
      sampled: p.sampled || closest.length < p.events.length, events: closest.map(item => item.event) }
  })
  const strongest = !focus && match.teamfights?.length
    ? [...match.teamfights].map((f, index) => ({ index, impact: Math.abs((f.players || []).slice(0, 5).reduce((n, p) => n + (p.gold_delta || 0), 0) - (f.players || []).slice(5, 10).reduce((n, p) => n + (p.gold_delta || 0), 0)) }))
      .sort((a, b) => b.impact - a.impact)[0]?.index : undefined
  const fight = strongest !== undefined ? fightDetailEvidence(match, strongest) : undefined
  const reviewPacket = {
    coverage: review.coverage, losingSide: review.losingSide,
    draft: cap(review.draft, 20),
    turns: review.turns.map(t => ({ ...t, nearbyEvents: cap(t.nearbyEvents, 3) })),
    laning10: review.laning10,
    purchasesByPlayer,
    fights: selectedFights.map(f => ({
      time: f.time, radiantDeaths: f.radiantDeaths, direDeaths: f.direDeaths,
      radiantGoldChange: f.radiantGoldChange, direGoldChange: f.direGoldChange,
      participants: f.participants.filter(p => p.deaths || p.damage || p.goldChange || p.xpChange),
      objectivesWithin3Minutes: cap(f.objectivesWithin3Minutes, 3)
    }))
  }
  const evidence = {
    match_id: base.match_id, duration: base.duration, winning_side: base.winning_side,
    score: base.score, parsed: base.parsed,
    players: base.players.map(({ death_times: _deathTimes, ...p }) => p),
    gold_advantage_per_minute: base.gold_advantage_per_minute.filter((_, i) => i % 2 === 0),
    whole_match_review: reviewPacket,
    events: cap(objectives, focus ? 0 : 12),
    ...(focus ? { focused_fight: compactFight(focus, focusedFightIndex!) } : {}),
    ...(fight ? { fight_breakdowns: [compactFight(fight, strongest!)] } : {}),
    sampling: { reduced: fullEventCount > 100 || review.fights.length > 40, full_event_count: fullEventCount, full_fight_count: review.fights.length, note: '证据包会在长度超限时按优先级缩减；字段缺失不代表事件未发生。' }
  }
  if (length(evidence) <= MAX_EVIDENCE_LENGTH) return evidence

  evidence.sampling.reduced = true
  reviewPacket.fights = reviewPacket.fights.slice(0, 2).map(f => ({ ...f, participants: f.participants.filter(p => p.deaths || Math.abs(p.goldChange) >= 300) }))
  reviewPacket.purchasesByPlayer = reviewPacket.purchasesByPlayer.map(p => ({ ...p, sampled: p.sampled || p.events.length > 2, events: cap(p.events, 2) }))
  evidence.events = []
  if (length(evidence) <= MAX_EVIDENCE_LENGTH) return evidence

  evidence.sampling.reduced = true
  reviewPacket.fights = []
  reviewPacket.purchasesByPlayer = reviewPacket.purchasesByPlayer.map(p => ({ ...p, sampled: true, events: [] }))
  evidence.gold_advantage_per_minute = cap(evidence.gold_advantage_per_minute, 10)
  if (length(evidence) <= MAX_EVIDENCE_LENGTH) return evidence

  reviewPacket.draft = []
  reviewPacket.turns = reviewPacket.turns.map(t => ({ ...t, nearbyEvents: [] }))
  if (length(evidence) <= MAX_EVIDENCE_LENGTH) return evidence

  // Keep the match result and selected fight totals even with unusually long names or logs.
  const packet = evidence as Record<string, unknown>
  delete packet.fight_breakdowns
  evidence.players = evidence.players.map(p => ({ ...p, name: p.name.slice(0, 40), hero: p.hero.slice(0, 40) }))
  reviewPacket.turns = []
  reviewPacket.laning10 = []
  evidence.gold_advantage_per_minute = []
  if (length(evidence) <= MAX_EVIDENCE_LENGTH) return evidence

  delete packet.focused_fight
  evidence.players = []
  return evidence
}
