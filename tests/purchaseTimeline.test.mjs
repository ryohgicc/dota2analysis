import test from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { PurchaseTimeline } from '../src/PurchaseTimeline.tsx'

test('purchase grid separates teams and buckets pregame purchases and map objectives', () => {
  const markup = renderToStaticMarkup(createElement(PurchaseTimeline, { match: {
    match_id: 123, duration: 660, radiant_win: true, players: [
      { player_slot: 0, hero_id: 1, personaname: 'A', purchase_log: [{ time: -35, key: 'blink' }, { time: 300, key: 'boots' }, { time: 601, key: 'tango' }] },
      { player_slot: 128, hero_id: 2, personaname: 'B', purchase_log: [{ time: 599, key: 'blink' }] }
    ], objectives: [{ type: 'building_kill', time: 310, key: 'npc_dota_badguys_tower1_mid' }]
  } }))
  assert.match(markup, /天辉 · 购买记录/)
  assert.match(markup, /夜魇 · 购买记录/)
  assert.match(markup, /显示消耗品/)
  assert.match(markup, /-00:35/)
  assert.match(markup, /05:00/)
  assert.match(markup, /05:10/)
  assert.match(markup, /夜魇中路1 塔/)
  assert.doesNotMatch(markup, /购买树之祭祀/)
  assert.equal((markup.match(/class="purchase-player-row/g) || []).length, 2)
})
