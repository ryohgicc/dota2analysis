import test from 'node:test'
import assert from 'node:assert/strict'
import { recentStats, WINDOWS } from '../src/recentStats.ts'

const match = (id, win, hero, kills, deaths, assists) => ({ match_id: id, radiant_win: win, player_slot: 0, hero_id: hero, kills, deaths, assists })

test('recent window uses only latest N games and correct win/side KDA', () => {
  const games = [match(1, true, 1, 6, 2, 8), match(2, false, 2, 2, 4, 4), match(3, false, 3, 0, 0, 1), match(4, true, 4, 12, 8, 8), match(5, true, 5, 6, 3, 12), match(6, true, 1, 50, 0, 50)]
  const result = recentStats(games, 5)
  assert.equal(result.count, 5)
  assert.equal(result.wins, 3)
  assert.equal(result.winRate, 60)
  assert.equal(result.uniqueHeroes, 5)
  assert.equal(result.avgKills, 26 / 5)
  assert.equal(result.kda, (26 + 33) / 17)
  assert.equal(recentStats(games, 10).count, 6)
  assert.deepEqual(WINDOWS, [5, 10, 20, 100])
})
test('five axes use bounded, labeled formulas and account for partial history', () => {
  const games = [match(1, true, 1, 30, 0, 30), match(2, false, 1, 30, 0, 30)]
  const stats = recentStats(games, 100)
  assert.equal(stats.count, 2)
  assert.equal(stats.winRate, 50)
  assert.equal(stats.axes.length, 5)
  assert.equal(stats.axes.find(axis => axis.label === '击杀').score, 100)
  assert.equal(stats.axes.find(axis => axis.label === '英雄覆盖').score, 50)
  assert.ok(stats.axes.every(axis => axis.score >= 0 && axis.score <= 100 && axis.rule))
  assert.equal(recentStats([], 5).axes.every(axis => axis.score === 0), true)
})

test('recognizes a Dire win and keeps KDA finite when nobody died', () => {
  const games = [
    { ...match(1, false, 1, 3, 0, 2), player_slot: 128 },
    { ...match(2, true, 2, 1, 0, 4), player_slot: 128 }
  ]
  const result = recentStats(games, 5)
  assert.equal(result.wins, 1)
  assert.equal(result.losses, 1)
  assert.equal(result.kda, 10)
  assert.equal(result.axes.find(axis => axis.label === '生存').score, 100)
})
