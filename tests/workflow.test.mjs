import test from 'node:test'
import assert from 'node:assert/strict'
import { runReview } from '../worker/review.ts'
import { encryptApiKey } from '../functions/api/jobCrypto.ts'

const secret = 'e'.repeat(64)
const originalFetch = globalThis.fetch
const payload = async () => ({ jobId: 'job-1', matchId: '9008437477', scope: 'whole', fightIndex: -1, baseUrl: 'https://api.openai.com/v1', model: 'demo',
  encryptedKey: await encryptApiKey('private-key', secret), language: '简体中文', prompt: '复盘', chunks: ['[{"path":"score","value":"2:1"}]', '[{"path":"players","value":[]}]'] })

function setup() {
  const state = { status: 'queued', step: 0, error: '', analyses: [] }
  const env = { AI_JOB_SECRET: secret, DB: {
    prepare(sql) { return { bind(...args) { return { async run() {
      if (sql.startsWith('UPDATE')) Object.assign(state, { status: args[0], step: args[1], error: args[2] })
      if (sql.startsWith('INSERT')) state.analyses.push(args)
    } } } } },
    async batch(statements) { for (const statement of statements) await statement.run() }
  } }
  const step = { async do(_name, config, action) { return (action || config)() } }
  return { env, step, state }
}

test('workflow continues independently of the browser and saves the final review in history', async () => {
  const { env, step, state } = setup()
  let calls = 0
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://api.openai.com/v1/chat/completions')
    assert.equal(options.headers.Authorization, 'Bearer private-key')
    assert.equal(options.redirect, 'manual')
    calls++
    return Response.json({ choices: [{ message: { content: calls === 3 ? '【对局情况】均势。' : `已整理第 ${calls} 段` } }] })
  }
  try {
    await runReview(env, await payload(), step)
    assert.equal(calls, 3)
    assert.equal(state.status, 'completed')
    assert.equal(state.step, 3)
    assert.equal(state.analyses[0][3], '【对局情况】均势。')
  } finally { globalThis.fetch = originalFetch }
})

test('workflow marks a failed model response without exposing upstream contents or saving a partial review', async () => {
  const { env, step, state } = setup()
  globalThis.fetch = async () => new Response('private provider details', { status: 524 })
  try {
    await runReview(env, await payload(), step)
    assert.equal(state.status, 'failed')
    assert.equal(state.error, '模型服务响应超时')
    assert.equal(state.analyses.length, 0)
  } finally { globalThis.fetch = originalFetch }
})
