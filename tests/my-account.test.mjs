import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { MyAccount } from '../src/MyAccount.tsx'
import { RecentStats } from '../src/PerformancePanel.tsx'
import { recentStats } from '../src/recentStats.ts'

const render = element => renderToStaticMarkup(createElement(MemoryRouter, null, element))

test('my account is shown separately with binding and unbinding controls', () => {
  const unbound = render(createElement(MyAccount, { id: '', onBind() {}, onUnbind() {} }))
  assert.match(unbound, /绑定我的账号/)
  assert.match(unbound, /Steam 账号 ID/)
  const bound = render(createElement(MyAccount, { id: '123', onBind() {}, onUnbind() {} }))
  assert.match(bound, /href="\/players\/123"/)
  assert.match(bound, /解除绑定/)
  assert.doesNotMatch(bound, /<form/)
})

test('comparison is offered for another player and uses independent recent windows', () => {
  assert.match(render(createElement(RecentStats, { id: '456', ownId: '123' })), /和我对比/)
  assert.doesNotMatch(render(createElement(RecentStats, { id: '123', ownId: '123' })), /和我对比/)
  assert.match(render(createElement(RecentStats, { id: '456', ownId: '' })), /绑定我的账号以对比/)
  const game = (match_id, kills) => ({ match_id, radiant_win: true, player_slot: 0, hero_id: 1, kills, deaths: 1, assists: 2 })
  const other = recentStats([game(1, 10), game(2, 20)], 5)
  const mine = recentStats([game(3, 4)], 5)
  assert.equal(other.count, 2)
  assert.equal(mine.count, 1)
  assert.equal(other.avgKills, 15)
  assert.equal(mine.avgKills, 4)
})
