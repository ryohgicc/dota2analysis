import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { MatchPlayerName } from '../src/MatchPlayerName.tsx'

const renderName = player => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(MatchPlayerName, { player })))

test('match player name links to the local profile for a valid account', () => {
  const markup = renderName({ account_id: 123, personaname: '玩家甲' })
  assert.match(markup, /href="\/players\/123"/)
  assert.match(markup, /玩家甲/)
})

test('anonymous or invalid account ids stay plain text', () => {
  for (const account_id of [undefined, 0, -1, 4294967296]) {
    const markup = renderName({ account_id })
    assert.doesNotMatch(markup, /<a /)
    assert.match(markup, /匿名玩家/)
  }
})
