import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestGet as openDota } from '../functions/api/opendota/[kind]/[id].ts'
import { onRequestPost as analyze } from '../functions/api/analyze.ts'

const originalFetch = globalThis.fetch
const context = (kind, id, query = '') => ({ params: { kind, id }, request: new Request(`https://site.pages.dev/api/opendota/${kind}/${id}${query}`) })

test('Pages OpenDota route rejects invalid IDs and only forwards accepted filters', async () => {
  assert.equal((await openDota(context('match', 'not-an-id'))).status, 400)
  assert.equal((await openDota(context('bad', '123'))).status, 400)
  const calls = []
  globalThis.fetch = async (url) => { calls.push(String(url)); return Response.json([]) }
  try {
    const response = await openDota(context('matches', '123', '?limit=999&hero_id=2&win=no&offset=20&evil=x'))
    assert.equal(response.status, 200)
    assert.deepEqual(calls, ['https://api.opendota.com/api/players/123/matches?limit=100&hero_id=2&offset=20'])
  } finally { globalThis.fetch = originalFetch }
})

test('Pages OpenDota route handles missing matches and upstream errors', async () => {
  globalThis.fetch = async () => Response.json(null)
  try {
    const response = await openDota(context('match', '123'))
    assert.equal(response.status, 404)
    assert.match((await response.json()).error, /尚未收录/)
  } finally { globalThis.fetch = originalFetch }
  globalThis.fetch = async () => Response.json({ error: 'upstream private error' }, { status: 500 })
  try {
    const response = await openDota(context('player', '123'))
    assert.equal(response.status, 502)
    assert.doesNotMatch((await response.text()), /private error/)
  } finally { globalThis.fetch = originalFetch }
})

const aiRequest = baseUrl => ({ request: new Request('https://site.pages.dev/api/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ baseUrl, apiKey: 'secret', model: 'model', messages: [{ role: 'user', content: 'hi' }] }) }), env: {} })

test('Pages AI route rejects local and DNS-resolved private destinations', async () => {
  assert.equal((await analyze(aiRequest('https://127.0.0.1/v1'))).status, 400)
  globalThis.fetch = async url => {
    assert.match(String(url), /^https:\/\/cloudflare-dns\.com\/dns-query/)
    return Response.json({ Status: 0, Answer: [{ type: 1, data: '127.0.0.1' }] })
  }
  try {
    const response = await analyze(aiRequest('https://private.example/v1'))
    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /公开访问/)
  } finally { globalThis.fetch = originalFetch }
})

test('Pages AI route forwards an allowed completion without persisting a test request', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push(String(url))
    if (String(url).startsWith('https://cloudflare-dns.com/')) return Response.json({ Status: 0, Answer: [{ type: 1, data: '1.1.1.1' }] })
    assert.equal(options.headers.Authorization, 'Bearer secret')
    return Response.json({ choices: [{ message: { content: 'OK' } }] })
  }
  try {
    const response = await analyze(aiRequest('https://public.example/v1'))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { content: 'OK', saved: false })
    assert.equal(calls.at(-1), 'https://public.example/v1/chat/completions')
  } finally { globalThis.fetch = originalFetch }
})


test('Pages AI route bounds upstream time and hides 524 response details', async () => {
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('https://cloudflare-dns.com/')) return Response.json({ Status: 0, Answer: [{ type: 1, data: '1.1.1.1' }] })
    assert.equal(options.signal?.aborted, false)
    assert.equal(options.redirect, 'manual')
    return new Response('error code: 524, private provider details', { status: 524 })
  }
  try {
    const response = await analyze(aiRequest('https://public.example/v1'))
    assert.equal(response.status, 502)
    assert.deepEqual(await response.json(), { error: '模型服务返回 524' })
  } finally { globalThis.fetch = originalFetch }
})
import { onRequestPost as trumpets } from '../functions/api/trumpets.ts'

test('trumpet route checks each account once per UTC day and reuses D1 rows', async () => {
  const rows = new Map()
  const calls = []
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async all() {
              if (!sql.startsWith('SELECT')) return { results: [] }
              return { results: values.slice(1).flatMap(accountId => { const row = rows.get(accountId); return row ? [row] : [] }) }
            },
            async first() {
              const row = rows.get(values[0])
              return row || null
            },
            async run() {
              const [accountId, checkedDate, trumpet_count, rules, checked_at] = values
              rows.set(accountId, { account_id: accountId, trumpet_count, rules, checked_at })
              return { success: true, meta: { changes: 1 } }
            }
          }
        }
      }
    }
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async url => {
    calls.push(String(url))
    return Response.json(Array.from({ length: 10 }, (_, index) => ({ player_slot: 0, radiant_win: index < 9, kills: 20, deaths: 0, assists: 0 })))
  }
  const request = accountIds => ({ request: new Request('https://site.pages.dev/api/trumpets', { method: 'POST', body: JSON.stringify({ accountIds }), headers: { 'content-type': 'application/json' } }), env: { DB: db } })
  try {
    const first = await trumpets(request(['101', '102', '103', '104', '105', '106', '107', '108', '109', '110', '111']))
    assert.equal(first.status, 200)
    assert.equal(calls.length, 10)
    const second = await trumpets(request(['101', '102']))
    assert.equal(second.status, 200)
    assert.equal(calls.length, 10)
  } finally { globalThis.fetch = originalFetch }
})
