import { aiEvidence, timeline, type Match } from './data'
import { reviewEvidence } from './review'
import { fightDetailEvidence } from './fightDetail'

const MAX_EVIDENCE_LENGTH = 37000

/** Preserve all evidence for ordinary matches and label any reductions on unusually long matches. */
export function buildAnalysisEvidence(match: Match, focusedFightIndex?: number) {
  const base = aiEvidence(match)
  const review = reviewEvidence(match)
  const fullEventCount = timeline(match).filter(e => e.type !== 'system').length
  const evidence: typeof base & { whole_match_review: typeof review; sampling: { reduced: boolean; full_event_count: number; full_fight_count: number }; focused_fight?: ReturnType<typeof fightDetailEvidence>; fight_breakdowns?: ReturnType<typeof fightDetailEvidence>[] } = { ...base, whole_match_review: review, sampling: { reduced: fullEventCount > base.events.length || review.purchasesByPlayer.some(p => p.sampled), full_event_count: fullEventCount, full_fight_count: review.fights.length } }
  if (focusedFightIndex !== undefined && Number.isInteger(focusedFightIndex)) {
    const selected = fightDetailEvidence(match, focusedFightIndex)
    if (selected) {
      // Selected event already has full per-player detail; remove redundant all-match arrays.
      evidence.teamfights = []
      evidence.whole_match_review.fights = []
      evidence.events = evidence.events.filter(e => e.type === 'objective').slice(0, 40)
      evidence.whole_match_review.purchasesByPlayer = evidence.whole_match_review.purchasesByPlayer.map(p => ({ ...p, events: p.events.slice(-5) }))
      evidence.sampling.reduced = true
      evidence.focused_fight = selected
    }
  } else if (match.teamfights?.length) {
    const selected = (match.teamfights || []).map((f, index) => ({ index, impact: Math.abs((f.players || []).slice(0, 5).reduce((n, p) => n + (p.gold_delta || 0), 0) - (f.players || []).slice(5, 10).reduce((n, p) => n + (p.gold_delta || 0), 0)) })).sort((a, b) => b.impact - a.impact).slice(0, 2)
    evidence.fight_breakdowns = selected.map(({ index }) => {
      const detail = fightDetailEvidence(match, index)!
      return { ...detail, participants: detail.participants.map(p => ({ ...p, abilitiesUsed: p.abilitiesUsed.slice(0, 4), itemsUsed: p.itemsUsed.slice(0, 4), recordedDeathPositions: p.recordedDeathPositions.slice(0, 2) })) }
    })
    if (JSON.stringify(evidence).length > MAX_EVIDENCE_LENGTH) {
      evidence.sampling.reduced = true
      evidence.teamfights = []
      evidence.events = evidence.events.filter(e => e.type === 'objective').slice(0, 40)
      evidence.whole_match_review.fights = evidence.whole_match_review.fights.map(f => ({ ...f, participants: [] }))
    }
  }
  const fits = () => JSON.stringify(evidence).length <= MAX_EVIDENCE_LENGTH
  if (fits()) return evidence

  evidence.sampling.reduced = true
  // The full per-player fight record already exists in whole_match_review.
  evidence.teamfights = []
  if (fits()) return evidence

  const events = base.events
  evidence.events = events.filter(e => e.type !== 'kill')
  if (fits()) return evidence

  const fights = review.fights
  const important = [...fights].sort((a, b) => Math.abs(b.radiantGoldChange - b.direGoldChange) - Math.abs(a.radiantGoldChange - a.direGoldChange)).slice(0, 12)
  const sampled = fights.filter((_, index) => index % Math.max(1, Math.ceil(fights.length / 8)) === 0)
  evidence.whole_match_review.fights = [...new Set([...important, ...sampled])].sort((a, b) => a.time.localeCompare(b.time))
  if (fits()) return evidence

  evidence.whole_match_review.purchasesByPlayer = evidence.whole_match_review.purchasesByPlayer.map(p => ({ ...p, events: [...p.events.slice(0, 2), ...p.events.slice(-5)] }))
  if (fits()) return evidence

  evidence.events = evidence.events.filter(e => e.type === 'objective').slice(0, 60)
  if (fits()) return evidence

  evidence.whole_match_review.fights = important.slice(0, 6).sort((a, b) => a.time.localeCompare(b.time))
  evidence.events = evidence.events.slice(0, 25)
  if (fits()) return evidence

  evidence.whole_match_review.fights = evidence.whole_match_review.fights.map(f => ({ ...f, participants: [], objectivesWithin3Minutes: f.objectivesWithin3Minutes.slice(0, 3) }))
  if (fits()) return evidence

  evidence.whole_match_review.fights = evidence.whole_match_review.fights.slice(0, 3)
  evidence.whole_match_review.purchasesByPlayer = evidence.whole_match_review.purchasesByPlayer.map(p => ({ ...p, events: p.events.slice(-2) }))
  evidence.whole_match_review.draft = []
  evidence.events = []
  if (fits()) return evidence
  // Keep the selected fight intact; for whole-match requests narrow to the strongest fight.
  if (evidence.fight_breakdowns?.length) evidence.fight_breakdowns = evidence.fight_breakdowns.slice(0, 1)
  if (fits()) return evidence
  evidence.whole_match_review.fights = []
  evidence.whole_match_review.purchasesByPlayer = []
  evidence.gold_advantage_per_minute = evidence.gold_advantage_per_minute.filter((_, i) => i % 2 === 0)
  return evidence
}
