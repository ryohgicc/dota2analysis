import test from 'node:test'
import assert from 'node:assert/strict'
import { cachedPlayerRequest, playerCacheKey, readPlayerCache } from '../src/playerCache.ts'

test('player request cache reuses a response and separates players and filters', async () => {
  const first = playerCacheKey('matches', '123', 'limit=5')
  const second = playerCacheKey('matches', '123', 'limit=100')
  const other = playerCacheKey('matches', '456', 'limit=5')
  let calls = 0
  const load = async () => { calls++; return [{ match_id: calls }] }
  const [a, b] = await Promise.all([cachedPlayerRequest(first, load), cachedPlayerRequest(first, load)])
  assert.deepEqual(a, b)
  assert.equal(calls, 1)
  assert.deepEqual(readPlayerCache(first), a)
  await cachedPlayerRequest(first, load)
  assert.equal(calls, 1)
  await cachedPlayerRequest(second, load)
  await cachedPlayerRequest(other, load)
  assert.equal(calls, 3)
})

test('expired entries reload and failures are not cached', async () => {
  const key = playerCacheKey('heroes', 'expired-player')
  const originalNow = Date.now
  let now = 10000
  Date.now = () => now
  try {
    let calls = 0
    const load = async () => ++calls
    assert.equal(await cachedPlayerRequest(key, load), 1)
    now += 120001
    assert.equal(readPlayerCache(key), undefined)
    assert.equal(await cachedPlayerRequest(key, load), 2)
    const failed = playerCacheKey('profile', 'failed-player')
    await assert.rejects(cachedPlayerRequest(failed, async () => { throw Error('unavailable') }))
    assert.equal(readPlayerCache(failed), undefined)
    assert.equal(await cachedPlayerRequest(failed, load), 3)
  } finally { Date.now = originalNow }
})
