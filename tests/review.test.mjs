import test from 'node:test'
import assert from 'node:assert/strict'
import { coverage, fightReviews, goldTurns, objectiveSide, reviewEvidence } from '../src/review.ts'

const players = Array.from({ length: 10 }, (_, i) => ({ player_slot: i < 5 ? i : i + 123, hero_id: i + 1, gold_t: Array.from({length: 11}, (_, minute) => minute * 300), xp_t: Array.from({length: 11}, (_, minute) => minute * 200), lh_t: Array.from({length: 11}, (_, minute) => minute * 5), lane_efficiency: .5, purchase_log: [{ time: 800, key: 'blink' }] }))
const match = { match_id: 1, radiant_win: false, radiant_gold_adv: [0, 200, 400, 900, 1500, 2300, 3000, 2800], players, teamfights: [{ start: 900, end: 940, players: players.map((_, i) => ({ deaths: i < 5 ? 1 : 0, gold_delta: i < 5 ? -200 : 400, damage: 250 })) }], objectives: [{ time: 980, type: 'building_kill', key: 'npc_dota_goodguys_tower2_mid' }, { time: 1140, type: 'CHAT_MESSAGE_ROSHAN_KILL', team: 3 }] }

test('selects real three minute economy windows with correct endpoints', () => {
  const turns = goldTurns(match)
  assert.ok(turns.every(t => t.change === match.radiant_gold_adv[t.endMinute] - match.radiant_gold_adv[t.startMinute]))
  assert.ok(turns.every((t, i) => i === 0 || t.startMinute >= turns[i - 1].endMinute))
})
test('attributes destroyed buildings to the attacking side and only includes objectives within three minutes', () => {
  assert.equal(objectiveSide(match.objectives[0]), 'dire')
  assert.equal(objectiveSide({ time: 10, type: 'building_kill', key: 'npc_dota_badguys_tower1_mid' }), 'radiant')
  const fight = fightReviews(match)[0]
  assert.deepEqual(fight.after.map(o => o.time), [980])
  assert.equal(fight.radiantDeaths, 5)
  assert.equal(fight.direDeaths, 0)
  assert.equal(fight.participants[5].player.player_slot, 128)
})
test('labels missing parsed fields as unavailable instead of estimating them', () => {
  assert.equal(coverage({ players: [{ player_slot: 0 }] }).laning, false)
  assert.equal(reviewEvidence({ players: [{ player_slot: 0 }], radiant_win: true }).fights.length, 0)
})

test('bounds long match evidence and labels sampled sections', async () => {
  const { buildAnalysisEvidence } = await import('../src/analysis.ts')
  const longMatch = {
    ...match,
    teamfights: Array.from({length: 120}, (_, n) => ({ ...match.teamfights[0], start: n * 75, end: n * 75 + 30 })),
    objectives: Array.from({length: 150}, (_, n) => ({time: n * 65, type: 'building_kill', key: `npc_dota_goodguys_tower${n}`}))
  }
  const evidence = buildAnalysisEvidence(longMatch)
  assert.equal(evidence.sampling.reduced, true)
  assert.equal(evidence.sampling.full_fight_count, 120)
  assert.ok(JSON.stringify(evidence).length <= 12000)
  const ordinary = buildAnalysisEvidence(match)
  assert.equal(ordinary.sampling.full_event_count, 13)
  assert.ok(ordinary.whole_match_review.purchasesByPlayer.some(p => p.events.length))
})

test('only associates logged events inside the selected economy window', async () => {
  const { turnContext } = await import('../src/review.ts')
  const near = turnContext(match, 15, 18)
  assert.deepEqual(near.map(e => e.time), [900, 980])
  assert.ok(!near.some(e => e.time === 1140))
})

test('renders Chinese hero and item labels and keeps every purchase in time order', async () => {
  const { timeline, heroNames } = await import('../src/data.ts')
  const { itemName } = await import('../src/locale.ts')
  assert.equal(heroNames[1].name, '敌法师')
  assert.equal(itemName('blink'), '闪烁匕首')
  assert.equal(itemName('totally_new_item'), '未收录物品（totally_new_item）')
  assert.equal(itemName('recipe_phase_boots'), '图纸（相位鞋）')
  const purchaseMatch = { players: [{ player_slot: 0, hero_id: 1, personaname: 'A', purchase_log: [{ time: 600, key: 'blink' }, { time: -10, key: 'tango' }] }], teamfights: [], objectives: [] }
  const purchases = timeline(purchaseMatch).filter(e => e.type === 'item')
  assert.deepEqual(purchases.map(e => e.time), [-10, 600])
  assert.equal(purchases[1].title, 'A 购买 闪烁匕首')
  assert.equal(purchases[1].playerSlot, 0)
})
test('AI evidence includes both teams purchase histories, named items and sampling metadata', async () => {
  const { buildAnalysisEvidence } = await import('../src/analysis.ts')
  const evidence = buildAnalysisEvidence(match)
  const gear = evidence.whole_match_review.purchasesByPlayer
  assert.equal(gear.length, 10)
  assert.equal(gear[0].events[0].item, '闪烁匕首')
  assert.equal(gear[5].slot, 128)
  assert.ok(evidence.sampling.full_event_count >= 10)
  assert.ok(!('key' in gear[0].events[0]))
})

test('objective details use Chinese names for known buildings and mark unknown targets', async () => {
  const { timeline } = await import('../src/data.ts')
  const events = timeline({ players: [], objectives: [{ time: 100, type: 'building_kill', key: 'npc_dota_goodguys_tower2_mid' }, { time: 110, type: 'building_kill', key: 'npc_dota_goodguys_melee_rax_mid' }] })
  assert.equal(events[0].detail, '天辉中路2 塔')
  assert.equal(events[1].detail, '天辉中路近战兵营')
  const unknown = timeline({ players: [], objectives: [{ time: 120, type: 'building_kill', key: 'npc_dota_new_structure' }] })
  assert.equal(unknown[0].detail, '未收录目标（npc_dota_new_structure）')
})
