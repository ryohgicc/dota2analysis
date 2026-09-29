import test from 'node:test'
import assert from 'node:assert/strict'
import { getMatch } from '../src/data.ts'

const originalFetch = globalThis.fetch

test('match details retry through the site proxy when OpenDota rejects direct requests', async () => {
  for (const status of [403, 429, 500]) {
    const calls = []
    globalThis.fetch = async url => {
      calls.push(String(url))
      return calls.length === 1 ? Response.json({ error: 'upstream failure' }, { status }) : Response.json({ match_id: 123, players: [] })
    }
    try {
      assert.equal((await getMatch('123')).match_id, 123)
      assert.deepEqual(calls, ['https://api.opendota.com/api/matches/123', '/api/opendota/match/123'])
    } finally { globalThis.fetch = originalFetch }
  }
})

test('missing matches preserve the unrecorded match message without proxying', async () => {
  const calls = []
  globalThis.fetch = async url => { calls.push(String(url)); return Response.json({}, { status: 404 }) }
  try {
    await assert.rejects(getMatch('456'), /尚未收录/)
    assert.deepEqual(calls, ['https://api.opendota.com/api/matches/456'])
  } finally { globalThis.fetch = originalFetch }
})

test('network failure retries filtered player matches using the proxy route', async () => {
  const { getMatches } = await import('../src/data.ts')
  const calls = []
  globalThis.fetch = async url => {
    calls.push(String(url))
    if (calls.length === 1) throw Error('network error')
    return Response.json([])
  }
  try {
    assert.deepEqual(await getMatches('123', { limit: 5, offset: 20 }), [])
    assert.deepEqual(calls, [
      'https://api.opendota.com/api/players/123/matches?limit=5&offset=20',
      '/api/opendota/matches/123?limit=5&offset=20'
    ])
  } finally { globalThis.fetch = originalFetch }
})


test('match details bypass browser HTTP cache so a newly parsed result can load', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => { calls.push({ url: String(url), cache: options?.cache }); return Response.json({ match_id: 123, players: [] }) }
  try {
    await getMatch('123')
    assert.deepEqual(calls, [{ url: 'https://api.opendota.com/api/matches/123', cache: 'no-store' }])
  } finally { globalThis.fetch = originalFetch }
})
