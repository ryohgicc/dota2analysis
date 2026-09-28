import test from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { MatchScoreboard } from '../src/MatchScoreboard.tsx'
import { itemKeyById } from '../src/data.ts'

test('scoreboard shows match scores, Chinese item labels and distinguishes missing items', () => {
  assert.equal(itemKeyById['1'], 'blink')
  const markup = renderToStaticMarkup(createElement(MatchScoreboard, { match: {
    match_id: 1, radiant_win: false, radiant_score: 21, dire_score: 30,
    players: [{ player_slot: 0, hero_id: 1, kills: 4, deaths: 2, assists: 3, last_hits: 30, denies: 4, net_worth: 4500, gold_per_min: 400, xp_per_min: 500, item_0: 1, item_1: 0, item_2: 999999 }, { player_slot: 128, hero_id: 2, kills: 6, deaths: 1, assists: 5, gold_per_min: 600, xp_per_min: 700 }]
  } }))
  assert.match(markup, /21 击杀/)
  assert.match(markup, /30 击杀/)
  assert.match(markup, /闪烁匕首/)
  assert.match(markup, /未收录物品（ID 999999）/)
  assert.match(markup, /4,500/)
  assert.equal((markup.match(/scoreboard-winner/g) || []).length, 1)
})
