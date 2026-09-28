import test from 'node:test'
import assert from 'node:assert/strict'
import { testAiConnection } from '../src/aiConnection.ts'

const settings = { baseUrl: 'https://api.openai.com/v1', apiKey: 'test-key', model: 'demo' }

test('tests current form values via an actual completion request without match data', async () => {
  let calls = 0
  await testAiConnection(settings, async (url, options) => {
    calls++
    assert.equal(url, '/api/analyze')
    const body = JSON.parse(options.body)
    assert.deepEqual([body.baseUrl, body.apiKey, body.model], [settings.baseUrl, settings.apiKey, settings.model])
    assert.deepEqual(body.messages, [{ role: 'user', content: '请只回复 OK。' }])
    return Response.json({ content: 'OK' })
  })
  assert.equal(calls, 1)
})

test('rejects missing config without sending a request', async () => {
  await assert.rejects(testAiConnection({ ...settings, model: '  ' }, () => { throw Error('should not send') }), /请先填写/)
})

test('rejects empty responses and hides upstream errors from the UI', async () => {
  await assert.rejects(testAiConnection(settings, async () => Response.json({ content: ' ' })), /未返回文本/)
  await assert.rejects(testAiConnection(settings, async () => Response.json({ error: 'secret upstream payload' }, { status: 502 })), error => !error.message.includes('secret'))
})

test('maps common model errors without exposing upstream response text', async () => {
  await assert.rejects(testAiConnection(settings, async () => Response.json({ error: '模型服务返回 401：secret upstream payload' }, { status: 502 })), /拒绝授权/)
  await assert.rejects(testAiConnection(settings, async () => Response.json({ error: '模型服务返回 404：secret upstream payload' }, { status: 502 })), /模型接口或模型不存在/)
  await assert.rejects(testAiConnection(settings, async () => Response.json({ error: '模型服务返回 429：secret upstream payload' }, { status: 502 })), /额度不足/)
})
