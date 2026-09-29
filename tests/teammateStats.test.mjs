import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizePeerTeammates, enemyRules } from '../src/teammateStats.ts'

const game = (match_id, won, deaths = 5) => ({ match_id, player_slot: 0, radiant_win: won, deaths })
const peer = (account_id, with_games, with_win, personaname = '') => ({ account_id, with_games, with_win, personaname })

test('peers provide recent 50 game counts and shared win rates without match details', () => {
  const result = summarizePeerTeammates('10', [peer(20, 49, 25, '队友'), peer(30, 2, 2), peer(0, 30, 25), peer(10, 12, 10)])
  assert.deepEqual(result, [{ accountId: 20, name: '队友', games: 49, wins: 25, winRate: 51, enemyRules: [] }])
})

test('compares the teammate last 20 matches with and without the current player', () => {
  const recent = Array.from({ length: 20 }, (_, i) => game(i + 1, i >= 3))
  const shared = recent.slice(0, 3)
  const result = summarizePeerTeammates('10', [peer(20, 4, 1)], new Map([[20, { recent, shared }]]))
  assert.deepEqual(result[0].enemyRules, [enemyRules[0]])
  assert.deepEqual(summarizePeerTeammates('10', [peer(20, 4, 1)], new Map([[20, { recent: shared, shared }]]))[0].enemyRules, [])
})

test('ten shared games are required for death and win rate reasons', () => {
  const shared = Array.from({ length: 10 }, (_, i) => game(i + 1, i < 2, i < 3 ? 11 : 10))
  const result = summarizePeerTeammates('10', [peer(20, 10, 2)], new Map([[20, { recent: shared, shared }]]))
  assert.deepEqual(result[0].enemyRules, [enemyRules[1], enemyRules[2]])
  const partial = shared.slice(0, 9)
  assert.deepEqual(summarizePeerTeammates('10', [peer(20, 10, 2)], new Map([[20, { recent: partial, shared: partial }]]))[0].enemyRules, [])
})

test('failed history lookups leave the peer visible without unsupported enemy badges', () => {
  assert.deepEqual(summarizePeerTeammates('10', [peer(20, 5, 2)])[0].enemyRules, [])
})
