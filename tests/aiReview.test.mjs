import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewInstructions, splitAiReview } from '../src/aiReview.ts'

test('whole match asks for a concrete cause, evidence and conditional player attribution', () => {
  const prompt = reviewInstructions('简体中文', 'whole')
  assert.match(prompt, /【败因总结】/)
  assert.match(prompt, /至少两个互相支持的关键事件/)
  assert.match(prompt, /无法根据现有数据判定某位玩家导致失利/)
  assert.match(prompt, /中文名称/)
  assert.match(prompt, /购买时间不等于装备合成完成/)
})

test('splits a model summary from its evidence while preserving plain text fallback', () => {
  assert.deepEqual(splitAiReview('【败因总结】中期团战失利。\n【复盘依据】\n20:00 团战损失。', 'whole'), { summary: '中期团战失利。', details: '20:00 团战损失。' })
  assert.deepEqual(splitAiReview('自由格式回答', 'whole'), { summary: '', details: '自由格式回答' })
  assert.deepEqual(splitAiReview('【节点结论】该节点失败。\n【复盘依据】\n经济下滑。', 'event'), { summary: '该节点失败。', details: '经济下滑。' })
})
