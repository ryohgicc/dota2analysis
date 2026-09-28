import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewInstructions, splitAiReview } from '../src/aiReview.ts'

test('whole match asks for a concrete cause, evidence and conditional player attribution', () => {
  const prompt = reviewInstructions('简体中文', 'whole')
  assert.match(prompt, /【对局情况】/)
  assert.match(prompt, /碾压.*均势.*翻盘/)
  assert.match(prompt, /【胜负关键】/)
  assert.match(prompt, /最多 3 个值得回看的具体片段/)
  assert.match(prompt, /无需为了凑齐选手、阵容、对线、团战而逐项罗列/)
  assert.match(prompt, /不要输出【事实】【推断】【信心】标签/)
  assert.match(prompt, /中文名称/)
  assert.match(prompt, /购买时间/)
  assert.match(prompt, /抽样数据只在结尾用一句话提醒/)
})

test('focused review stays concise and does not force unrelated match categories', () => {
  const prompt = reviewInstructions('简体中文', 'event')
  assert.match(prompt, /【节点结论】/)
  assert.match(prompt, /最多 2 个最值得回看的细节/)
  assert.match(prompt, /不要重复整场赛果/)
})

test('splits a model summary from its evidence while preserving plain text fallback', () => {
  assert.deepEqual(splitAiReview('【对局情况】均势，25分钟团战决定胜负。\n【胜负关键】团战处理。\n【具体展开】需要回放核对。', 'whole'), { summary: '均势，25分钟团战决定胜负。', details: '【胜负关键】团战处理。\n【具体展开】需要回放核对。' })
  assert.deepEqual(splitAiReview('自由格式回答', 'whole'), { summary: '', details: '自由格式回答' })
  assert.deepEqual(splitAiReview('【节点结论】该节点失败。\n【复盘依据】\n经济下滑。', 'event'), { summary: '该节点失败。', details: '经济下滑。' })
})
