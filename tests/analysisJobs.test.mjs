import test from 'node:test'
import assert from 'node:assert/strict'
import { onRequestPost, onRequestGet } from '../functions/api/analysis-jobs.ts'
import { decryptApiKey, encryptApiKey } from '../functions/api/jobCrypto.ts'

const secret = 'a'.repeat(64)
const originalFetch = globalThis.fetch
const payload = { matchId: '9018403896', scope: 'whole', baseUrl: 'https://public.example/v1', model: 'demo', apiKey: 'private-api-key', language: '简体中文', prompt: '复盘', chunks: ['[{"path":"players","value":[]}]'] }
const request = body => ({ request: new Request('https://site.pages.dev/api/analysis-jobs', { method: 'POST', body: JSON.stringify(body) }) })

function mockEnvironment() {
  const rows = new Map()
  let submitted
  const env = {
    AI_JOB_SECRET: secret,
    DB: { prepare(query) { return { bind(...args) { return {
      async run() {
        if (query.startsWith('INSERT INTO')) rows.set(args[0], { id: args[0], match_id: args[1], scope: args[2], fight_index: args[3], model: args[4], status: args[5], step: 0, total: args[6], error: '' })
        if (query.startsWith('UPDATE')) Object.assign(rows.get(args[2]), { status: args[0], error: args[1] })
      },
      async all() { return { results: [...rows.values()].filter(row => args[0] === undefined || row.match_id === args[0]) } }
    } } } } },
    WORKFLOW_SERVICE: { async createInstance(input) { submitted = input; return { id: input.jobId } } }
  }
  return { env, rows, getSubmitted: () => submitted }
}

test('encrypts the API key in background parameters and exposes only job metadata', async () => {
  const { env, getSubmitted } = mockEnvironment()
  globalThis.fetch = async () => Response.json({ Status: 0, Answer: [{ type: 1, data: '1.1.1.1' }] })
  try {
    const response = await onRequestPost({ ...request(payload), env })
    assert.equal(response.status, 202)
    const { jobId } = await response.json()
    assert.equal(getSubmitted().jobId, jobId)
    assert.doesNotMatch(JSON.stringify(getSubmitted()), /private-api-key/)
    assert.equal(await decryptApiKey(getSubmitted().encryptedKey, secret), 'private-api-key')
    const list = await onRequestGet({ request: new Request('https://site.pages.dev/api/analysis-jobs?matchId=9018403896'), env })
    assert.equal(list.status, 200)
    assert.equal((await list.json()).jobs[0].status, 'queued')
    assert.doesNotMatch(await (await onRequestGet({ request: new Request('https://site.pages.dev/api/analysis-jobs'), env })).text(), /private-api-key/)
  } finally { globalThis.fetch = originalFetch }
})

test('fails closed on invalid destinations, unconfigured services, and invalid payloads', async () => {
  const { env } = mockEnvironment()
  assert.equal((await onRequestPost({ ...request({ ...payload, chunks: [] }), env })).status, 400)
  assert.equal((await onRequestPost({ ...request({ ...payload, baseUrl: 'https://127.0.0.1/v1' }), env })).status, 400)
  globalThis.fetch = async () => Response.json({ Status: 0, Answer: [{ type: 1, data: '1.1.1.1' }] })
  try {
    assert.equal((await onRequestPost({ ...request(payload), env: { ...env, AI_JOB_SECRET: '' } })).status, 503)
  } finally { globalThis.fetch = originalFetch }
})

test('uses fresh random IVs for each encryption', async () => {
  const first = await encryptApiKey('private-api-key', secret)
  const second = await encryptApiKey('private-api-key', secret)
  assert.notDeepEqual(first, second)
  assert.equal(await decryptApiKey(second, secret), 'private-api-key')
})

test('history contains both completed whole-match and fight reviews', async () => {
  const { onRequestGet: history } = await import('../functions/api/analyses/index.ts')
  let query = ''
  const env = { DB: { prepare(sql) {
    query = sql
    return { bind() { return { async all() { return { results: [
      { match_id: '123', scope: 'whole', fight_index: -1, content: 'whole' },
      { match_id: '123', scope: 'event', fight_index: 2, content: 'event' }
    ] } } } } }
  } } }
  const response = await history({ request: new Request('https://site.pages.dev/api/analyses?limit=20'), env })
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).analyses.map(row => row.scope), ['whole', 'event'])
  assert.doesNotMatch(query, /scope\s*=/)
})
