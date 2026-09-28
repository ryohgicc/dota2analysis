import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

const port = 33000 + Math.floor(Math.random() * 2000)
const base = `http://127.0.0.1:${port}`
let server

test.before(async () => {
  server = spawn(process.execPath, ['--import', './tests/mock-ai.mjs', 'server/index.js'], { env: { ...process.env, PORT: String(port) }, stdio: 'pipe' })
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(`${base}/api/health`); if (r.ok) return } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw Error('服务器启动失败')
})
test.after(() => server?.kill())
test('rejects malformed OpenDota ID instead of forwarding an arbitrary path', async () => {
  for (const path of ['/api/opendota/match/x', '/api/opendota/other/123']) {
    const r = await fetch(`${base}${path}`)
    assert.equal(r.status, 400)
  }
})
test('validates AI request and rejects private destinations', async () => {
  const body = { baseUrl: 'https://127.0.0.1/v1', apiKey: 'test', model: 'test', messages: [{ role: 'user', content: 'hello' }] }
  const r = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal(r.status, 400)
  assert.match((await r.json()).error, /公开访问/)
  const missing = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  assert.equal(missing.status, 400)
})
test('serves SPA route after build', async () => {
  const r = await fetch(`${base}/matches/9018705307`)
  assert.equal(r.status, 200)
  assert.match(await r.text(), /Dota 2 比赛复盘/)
})

test('forwards OpenAI compatible completion and returns generated content', async () => {
  const body = { baseUrl: 'https://api.openai.com/v1', apiKey: 'test-key', model: 'demo', messages: [{ role: 'user', content: 'review this match' }] }
  const r = await fetch(`${base}/api/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal(r.status, 200)
  assert.equal((await r.json()).content, 'mock:demo:review this match:true')
})

test('submits a validated match ID to OpenDota and reports acceptance', async () => {
  const invalid = await fetch(`${base}/api/opendota/request/not-an-id`, { method: 'POST' })
  assert.equal(invalid.status, 400)
  const accepted = await fetch(`${base}/api/opendota/request/9018403896`, { method: 'POST' })
  assert.equal(accepted.status, 200)
  assert.deepEqual(await accepted.json(), { submitted: true, jobId: 12345 })
})
test('surfaces OpenDota rate limiting without leaking upstream errors', async () => {
  const limited = await fetch(`${base}/api/opendota/request/429`, { method: 'POST' })
  assert.equal(limited.status, 429)
  assert.match((await limited.json()).error, /请求频繁/)
  const failed = await fetch(`${base}/api/opendota/request/500`, { method: 'POST' })
  assert.equal(failed.status, 502)
  assert.doesNotMatch((await failed.json()).error, /token or upstream details/)
})

test('shows a recoverable missing-match state when OpenDota returns null', async () => {
  const missing = await fetch(`${base}/api/opendota/match/777777`)
  assert.equal(missing.status, 404)
  assert.match((await missing.json()).error, /尚未收录/)
  const emptyRequest = await fetch(`${base}/api/opendota/request/501`, { method: 'POST' })
  assert.equal(emptyRequest.status, 502)
})
