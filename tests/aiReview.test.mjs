import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewInstructions, splitAiReview } from '../src/aiReview.ts'

test('whole match asks for a concrete cause, evidence and conditional player attribution', () => {
  const prompt = reviewInstructions('简体中文', 'whole')
  assert.match(prompt, /standalone/)
  assert.match(prompt, /【比赛结论与数据边界】/)
  assert.match(prompt, /碾压.*均势.*翻盘/)
  assert.match(prompt, /【核心与辅助职责】/)
  assert.match(prompt, /【本人对局改进意见】/)
  assert.match(prompt, /不要输出【事实】【推断】【信心】标签/)
  assert.match(prompt, /中文名称/)
  assert.match(prompt, /购买时间/)
  assert.match(prompt, /哪些字段缺失或被抽样/)
})

test('focused review stays concise and does not force unrelated match categories', () => {
  const prompt = reviewInstructions('简体中文', 'event')
  assert.match(prompt, /【节点结论】/)
  assert.match(prompt, /最多 2 个细节/)
  assert.match(prompt, /不重复整场赛果/)
})

test('splits a model summary from its evidence while preserving plain text fallback', () => {
  assert.deepEqual(splitAiReview('【比赛结论与数据边界】均势，25分钟团战决定胜负。\n【全局博弈】团战处理。\n【本人对局改进意见】需要回放核对。', 'whole'), { summary: '均势，25分钟团战决定胜负。', details: '【全局博弈】团战处理。\n【本人对局改进意见】需要回放核对。' })
  assert.deepEqual(splitAiReview('自由格式回答', 'whole'), { summary: '', details: '自由格式回答' })
  assert.deepEqual(splitAiReview('【节点结论】该节点失败。\n【复盘依据】\n经济下滑。', 'event'), { summary: '该节点失败。', details: '经济下滑。' })
})
