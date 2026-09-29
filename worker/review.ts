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
            { role: 'system', content: `你在建立 Dota 2 复盘事实账本，不是在写最终评论。结合已有账本和本段数据，重写不超过 2600 字的累计事实记录。保留 Match ID、比赛时长、胜负与比分、数据覆盖/缺失、十名玩家和英雄、5/10 分钟资源、全时间经济转折、购买事件、关键技能/物品记录、全部可确认团战、死亡、买活、地图目标、建筑和肉山事件及其原始时间。每条记录尽量带时间、人物/英雄和字段 path；不要只保留模型认为重要的事件。区分“记录显示”与“尚无法判断”，不要推断责任、位置、视野、沟通、命中、持有或因果。字段 path 是原始数据位置；事件可能经过抽样，sampling.reduced=true 时必须保留这个限制。已有账本：${previous || '无'}` },
            { role: 'user', content: `第 ${index + 1}/${payload.chunks.length} 段比赛数据：${payload.chunks[index]}` }
          ])
          await mark('running', index + 1)
          return text.slice(0, 3200)
        })
      }
      const content = await step.do('final-review', { retries: { limit: 1, delay: '5 seconds' }, timeout: '75 seconds' }, () => completion(env, payload, [
        { role: 'system', content: `${reviewInstructions(payload.language, payload.scope)}以下是累计事实账本。先检查账本中的覆盖和限制，再完成报告；账本没有的事实不要补写。${payload.scope === 'whole' ? '完整模式必须覆盖十名玩家、三路/资源、装备、关键技能、关键团战和本人改进，即使部分栏目只能给出证据受限的结论。' : '专项模式只回答当前节点，不扩写无关栏目。'}` },
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
