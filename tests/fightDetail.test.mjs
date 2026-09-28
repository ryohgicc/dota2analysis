import test from 'node:test'
import assert from 'node:assert/strict'
import { fightDetail, fightDetailEvidence, mapPosition } from '../src/fightDetail.ts'
import { buildAnalysisEvidence } from '../src/analysis.ts'

const players = Array.from({ length: 10 }, (_, i) => ({ player_slot: i < 5 ? i : i + 123, hero_id: i + 1, personaname: `玩家${i}`, kills: 1, deaths: 1, assists: 1, gold_per_min: 400, xp_per_min: 500 }))
const match = {
  match_id: 123, radiant_win: false, radiant_score: 10, dire_score: 20, duration: 2200, players,
  teamfights: [{ start: 900, end: 940, players: players.map((_, i) => ({ deaths: i === 0 ? 1 : 0, damage: i === 0 ? 1234 : 20, healing: i === 0 ? 250 : 0, gold_delta: i < 5 ? -100 : 200, xp_delta: i < 5 ? -50 : 100, ability_uses: i === 0 ? { slark_pounce: 2 } : {}, item_uses: i === 0 ? { blink: 1 } : {}, deaths_pos: i === 0 ? { '139': { '133': 1, '999': 1 } } : {} })) }],
  objectives: [{ time: 980, type: 'building_kill', key: 'npc_dota_goodguys_tower2_mid' }, { time: 1150, type: 'CHAT_MESSAGE_ROSHAN_KILL', team: 3 }]
}

test('extracts supported per-player fight measures, localized uses and recorded death position', () => {
  const detail = fightDetail(match, 0)
  assert.equal(detail.radiantDeaths, 1)
  assert.equal(detail.direDeaths, 0)
  assert.equal(detail.radiantGold, -500)
  assert.equal(detail.direGold, 1000)
  assert.deepEqual(detail.positions, [{ x: 139, y: 133, slot: 0, hero: '敌法师', count: 1 }])
  assert.equal(detail.participants[0].abilities[0].name, '突袭')
  assert.equal(detail.participants[0].abilities[0].count, 2)
  assert.equal(detail.participants[0].items[0].name, '闪烁匕首')
  assert.equal(detail.participants[5].slot, 128)
  assert.equal(detail.objectives.length, 1)
  assert.equal(detail.objectives[0].side, 'dire')
  assert.equal(mapPosition(128, 128).left, '0%')
  assert.equal(mapPosition(128, 128).top, '100%')
  assert.equal(mapPosition(255, 255).top, '0%')
  assert.equal(fightDetail(match, 12), undefined)
})

test('focused AI evidence contains selected fight details while ordinary evidence keeps a bounded sample', () => {
  const selected = fightDetailEvidence(match, 0)
  assert.equal(selected.participants[0].abilitiesUsed[0].name, '突袭')
  assert.equal(selected.participants[0].recordedDeathPositions[0].x, 139)
  assert.equal(selected.objectivesWithin3Minutes.length, 1)
  const focused = buildAnalysisEvidence(match, 0)
  assert.equal(focused.focused_fight.participants[0].damage, 1234)
  assert.equal(focused.teamfights, undefined)
  assert.ok(JSON.stringify(focused).length <= 12000)
  const whole = buildAnalysisEvidence(match)
  assert.equal(whole.fight_breakdowns[0].participants[0].itemsUsed[0].name, '闪烁匕首')
})

test('long parsed match keeps key teamfight details in the whole-match AI request', () => {
  const large = {
    ...match,
    teamfights: Array.from({ length: 40 }, (_, n) => ({ ...match.teamfights[0], start: 900 + n * 80, end: 940 + n * 80 })),
    objectives: Array.from({ length: 100 }, (_, n) => ({ time: 940 + n * 80, type: 'building_kill', key: 'npc_dota_goodguys_tower2_mid' }))
  }
  const evidence = buildAnalysisEvidence(large)
  assert.ok(evidence.fight_breakdowns?.length)
  assert.ok(JSON.stringify(evidence).length <= 12000)
})

test('late high-impact fight survives the smaller whole-match packet', () => {
  const quiet = { ...match.teamfights[0], players: match.teamfights[0].players.map(p => ({ ...p, gold_delta: 0 })) }
  const late = { ...match.teamfights[0], start: 1800, end: 1840 }
  const evidence = buildAnalysisEvidence({ ...match, teamfights: [quiet, late] })
  assert.equal(evidence.fight_breakdowns[0].index, 1)
  assert.ok(evidence.whole_match_review.fights.some(f => f.time === '30:00'))
  assert.ok(JSON.stringify(evidence).length <= 12000)
})

test('very long player labels cannot exceed the AI evidence budget', () => {
  const oversized = { ...match, players: players.map(p => ({ ...p, personaname: '长'.repeat(3000) })) }
  const evidence = buildAnalysisEvidence(oversized, 0)
  assert.equal(evidence.sampling.reduced, true)
  assert.ok(JSON.stringify(evidence).length <= 12000)
})
