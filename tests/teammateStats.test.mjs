import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeTeammates } from '../src/teammateStats.ts'

const recent = (id, radiant = true) => ({ match_id: id, player_slot: radiant ? 0 : 128, radiant_win: radiant })
const detail = (id, radiant = true, teammates = []) => ({ match_id: id, radiant_win: radiant, players: [
  { account_id: 10, player_slot: radiant ? 0 : 128 },
  ...teammates.map(([account_id, player_slot, personaname]) => ({ account_id, player_slot, personaname }))
] })

test('counts only publicly identified teammates in the latest 50, with wins in shared matches', () => {
  const matches = Array.from({ length: 51 }, (_, i) => recent(i + 1, i !== 2))
  const details = matches.map((match, i) => detail(match.match_id, i === 0 ? false : match.radiant_win !== false, [
    [20, i === 2 ? 129 : 1, '队友'],
    [30, i === 2 ? 1 : 129, '对手'],
    [0, i === 2 ? 130 : 2, '匿名']
  ]))
  const result = summarizeTeammates('10', matches, details)
  assert.deepEqual(result, [{ accountId: 20, name: '队友', games: 50, wins: 49, winRate: 98, enemyRules: [] }])
})

test('requires three shared games, de-duplicates matches and handles Radiant and Dire', () => {
  const matches = [recent(1), recent(2, false), recent(3, false), recent(4), recent(4)]
  const details = [
    detail(1, true, [[20, 1, '甲'], [30, 129, '敌方']]),
    detail(2, true, [[20, 129, '甲'], [30, 1, '敌方']]),
    detail(3, true, [[20, 129, '甲'], [30, 1, '敌方']]),
    detail(4, false, [[30, 1, '敌方'], [20, 129, '甲']])
  ]
  assert.deepEqual(summarizeTeammates('10', matches, details), [{ accountId: 20, name: '甲', games: 3, wins: 1, winRate: 33, enemyRules: [] }])
  assert.deepEqual(summarizeTeammates('10', matches, details.slice(0, 2)), [])
})


test('adds enemy reasons from the teammate recent history and shared match details', () => {
  const recent = [recentMatch(1), recentMatch(2), recentMatch(3)]
  const details = [
    { ...detail(1, false, [[20, 1, '甲']]), players: [{ account_id: 10, player_slot: 0 }, { account_id: 20, player_slot: 1, personaname: '甲', deaths: 11 }, { account_id: 30, player_slot: 129 }] },
    { ...detail(2, false, [[20, 1, '甲']]), players: [{ account_id: 10, player_slot: 0 }, { account_id: 20, player_slot: 1, personaname: '甲', deaths: 11 }, { account_id: 30, player_slot: 129 }] },
    { ...detail(3, false, [[20, 1, '甲']]), players: [{ account_id: 10, player_slot: 0 }, { account_id: 20, player_slot: 1, personaname: '甲', deaths: 11 }, { account_id: 30, player_slot: 129 }] }
  ]
  const teammateHistory = Array.from({ length: 20 }, (_, i) => ({ ...recentMatch(i + 1), player_slot: i < 3 ? 1 : 129, radiant_win: i < 3 ? false : false }))
  const result = summarizeTeammates('10', recent, details, new Map([[20, teammateHistory]]))
  assert.equal(result[0].enemyRules.length, 1)
})

function recentMatch(id) { return recent(id) }
