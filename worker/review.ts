import type { WorkflowStep } from 'cloudflare:workers'
import { decryptApiKey } from '../functions/api/jobCrypto'
import { reviewInstructions } from '../src/aiReview'

type Scope = 'whole' | 'event'
export type Payload = { jobId: string; matchId: string; scope: Scope; fightIndex: number; baseUrl: string; model: string; encryptedKey: { iv: number[]; cipher: number[] }; language: string; prompt: string; chunks: string[] }
export type Env = { DB: D1Database; AI_REVIEW: Workflow<Payload>; AI_JOB_SECRET: string }

async function completion(env: Env, payload: Payload, messages: { role: 'system' | 'user'; content: string }[]) {
  const apiKey = await decryptApiKey(payload.encryptedKey, env.AI_JOB_SECRET)
  const endpoint = new URL(`${new URL(payload.baseUrl).pathname.replace(/\/$/, '')}/chat/completions`, payload.baseUrl)
  const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: payload.model, messages, temperature: 0.3 }), signal: AbortSignal.timeout(60000), redirect: 'manual' })
  if (!response.ok) throw Error(response.status === 524 ? '模型服务响应超时' : `模型服务返回 ${response.status}`)
  const data = await response.json() as { choices?: { message?: { content?: unknown } }[] }
  const text = data.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) throw Error('模型没有返回文本')
  return text
}

export async function runReview(env: Env, payload: Payload, step: WorkflowStep) {
    const mark = (status: string, count: number, error = '') => env.DB.prepare('UPDATE analysis_jobs SET status = ?, step = ?, error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(status, count, error, payload.jobId).run()
    try {
      await step.do('start', async () => { await mark('running', 0) })
      let notes = ''
      for (let index = 0; index < payload.chunks.length; index++) {
        const previous = notes
        notes = await step.do(`evidence-${index}`, { retries: { limit: 1, delay: '5 seconds' }, timeout: '75 seconds' }, async () => {
          const text = await completion(env, payload, [
            { role: 'system', content: `结合已有笔记和本段数据，重写不超过 1800 字的累计事实笔记；保留赛果、关键经济转折、最有影响的团战及能对应上的人物和时间，少抄零散数据。仅记录证据明确的事实；团战金钱变化不等于团战前经济差，不得推断责任或写最终复盘。字段 path 是原始数据位置；事件可能经过抽样。已有笔记：${previous || '无'}` },
            { role: 'user', content: `第 ${index + 1}/${payload.chunks.length} 段比赛数据：${payload.chunks[index]}` }
          ])
          await mark('running', index + 1)
          return text.slice(0, 2200)
        })
      }
      const content = await step.do('final-review', { retries: { limit: 1, delay: '5 seconds' }, timeout: '75 seconds' }, () => completion(env, payload, [
        { role: 'system', content: `${reviewInstructions(payload.language, payload.scope)}根据以下累计事实笔记输出最终复盘，直接回答玩家最想知道的“这把怎么输赢的”和“该回看哪两三个节点”。笔记是抽样证据，缺失信息不要补写；仅在影响结论时简短说明。` },
        { role: 'user', content: `${payload.prompt}\n\n比赛累计笔记：\n${notes}` }
      ]))
      if (content.length > 30000) throw Error('模型回复过长')
      await step.do('save-review', async () => {
        await env.DB.batch([
          env.DB.prepare('INSERT INTO analyses (match_id, scope, fight_index, content, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(match_id, scope, fight_index) DO UPDATE SET content = excluded.content, model = excluded.model, updated_at = CURRENT_TIMESTAMP').bind(payload.matchId, payload.scope, payload.fightIndex, content, payload.model),
          env.DB.prepare('UPDATE analysis_jobs SET status = ?, step = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind('completed', payload.chunks.length + 1, payload.jobId)
        ])
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : ''
      const safe = /^(模型服务响应超时|模型服务返回 \d{3}|模型没有返回文本)$/.test(reason) ? reason : '后台分析失败，请稍后重试'
      await mark('failed', 0, safe)
    }
}
