import test from 'node:test'
import assert from 'node:assert/strict'
import { evidenceChunks } from '../src/aiBatch.ts'

const settings = { baseUrl: 'https://public.example/v1', apiKey: 'secret', model: 'demo', language: '简体中文' }

test('splits every evidence field into bounded model inputs', () => {
  const evidence = { players: Array.from({ length: 30 }, (_, i) => ({ slot: i, name: `player${i}`, text: '装备'.repeat(100) })), note: '团战'.repeat(2500) }
  const chunks = evidenceChunks(evidence)
  assert.ok(chunks.length > 2)
  assert.ok(chunks.every(chunk => chunk.length <= 3500))
  assert.match(chunks.join(''), /player29/)
  assert.match(chunks.join(''), /文本片段 2/)
})
