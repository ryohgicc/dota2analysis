import test from 'node:test'
import assert from 'node:assert/strict'
import { earnedTrumpets, trumpetRules } from '../src/trumpets.ts'

const game = (id, overrides = {}) => ({ match_id: id, radiant_win: true, player_slot: 0, kills: 0, deaths: 5, assists: 0, ...overrides })

test('each qualifying condition earns one trumpet, including exact boundaries', () => {
  const games = Array.from({ length: 10 }, (_, i) => game(i, { kills: i < 6 ? 20 : 0, deaths: i < 5 ? 1 : 5, assists: 0 }))
  assert.deepEqual(earnedTrumpets(games), trumpetRules)
  assert.deepEqual(earnedTrumpets(games.map((match, i) => i === 9 ? { ...match, radiant_win: false } : match)), trumpetRules)
  assert.deepEqual(earnedTrumpets(games.map((match, i) => i >= 8 ? { ...match, radiant_win: false } : match)), trumpetRules.slice(1))
})

test('thresholds use strict counts and only the newest ten matches', () => {
  const games = Array.from({ length: 10 }, (_, i) => game(i, { radiant_win: i < 8, kills: i < 5 ? 15 : 0, deaths: i < 4 ? 1 : 5, assists: i < 2 ? 20 : 0 }))
  assert.deepEqual(earnedTrumpets(games), [trumpetRules[2]])
  assert.deepEqual(earnedTrumpets([game(99), ...games]), [trumpetRules[0], trumpetRules[2]])
  assert.deepEqual(earnedTrumpets([game(99, { kills: 30, deaths: 0, assists: 30 }), ...games]), [trumpetRules[0], trumpetRules[1], trumpetRules[2], trumpetRules[4]])
})

test('partial history cannot earn win rate, but can earn count-based trumpets', () => {
  const games = Array.from({ length: 6 }, (_, i) => game(i, { kills: 20, deaths: 0 }))
  assert.deepEqual(earnedTrumpets(games), trumpetRules.slice(1))
  assert.deepEqual(earnedTrumpets([]), [])
  assert.deepEqual(earnedTrumpets([game(1, { kills: 0, deaths: 0, assists: 7 }), game(2, { kills: 0, deaths: 0, assists: 7 }), game(3, { kills: 0, deaths: 0, assists: 7 })]), [trumpetRules[2]])
})
