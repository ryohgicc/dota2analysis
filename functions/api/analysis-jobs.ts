import { encryptApiKey } from './jobCrypto'
import { publicHost, validPublicHostname } from './analyze'

type JobPayload = { matchId?: unknown; scope?: unknown; fightIndex?: unknown; baseUrl?: unknown; model?: unknown; apiKey?: unknown; language?: unknown; prompt?: unknown; chunks?: unknown }
type Env = { DB: D1Database; AI_JOB_SECRET: string; WORKFLOW_SERVICE: { createInstance(payload: unknown): Promise<{ id: string }> } }
const failure = (error: string, status: number) => Response.json({ error }, { status })
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const raw = await request.text().catch(() => '')
  if (new TextEncoder().encode(raw).byteLength > 100 * 1024) return failure('任务数据过大', 413)
  let body: JobPayload
  try { body = JSON.parse(raw) } catch { return failure('任务参数无效', 400) }
  const { matchId, scope, fightIndex, baseUrl, model, apiKey, language, prompt, chunks } = body
  const index = scope === 'event' ? fightIndex : -1
  if (typeof matchId !== 'string' || !/^\d{1,20}$/.test(matchId) || !['whole', 'event'].includes(String(scope)) || scope === 'event' && (!Number.isSafeInteger(index) || Number(index) < 0)
    || typeof baseUrl !== 'string' || typeof model !== 'string' || !model.trim() || model.length > 100 || typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 512
    || typeof language !== 'string' || language.length > 30 || typeof prompt !== 'string' || prompt.length > 1200
    || !Array.isArray(chunks) || chunks.length < 1 || chunks.length > 12 || chunks.some(item => typeof item !== 'string' || item.length > 4000)) return failure('任务参数无效', 400)
  let url: URL
  try { url = new URL(baseUrl) } catch { return failure('Base URL 格式不正确', 400) }
  try {
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !validPublicHostname(url.hostname) || !await publicHost(url.hostname)) return failure('Base URL 必须是可公开访问的 HTTPS 地址', 400)
  } catch { return failure('模型服务地址暂时无法验证', 502) }
  if (!env.DB || !env.WORKFLOW_SERVICE || !env.AI_JOB_SECRET) return failure('后台分析服务未配置', 503)
  const jobId = crypto.randomUUID()
  try {
    const encryptedKey = await encryptApiKey(apiKey, env.AI_JOB_SECRET)
    await env.DB.prepare('INSERT INTO analysis_jobs (id, match_id, scope, fight_index, model, status, total) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(jobId, matchId, scope, index, model, 'queued', chunks.length + 1).run()
    await env.WORKFLOW_SERVICE.createInstance({ jobId, matchId, scope, fightIndex: index, baseUrl: url.toString(), model, encryptedKey, language, prompt, chunks })
    return Response.json({ jobId }, { status: 202, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    await env.DB.prepare('UPDATE analysis_jobs SET status = ?, error = ? WHERE id = ?').bind('failed', '任务提交失败，请稍后重试', jobId).run().catch(() => {})
    return failure('后台分析任务提交失败，请稍后重试', 503)
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const matchId = new URL(request.url).searchParams.get('matchId')
  if (matchId && !/^\d{1,20}$/.test(matchId)) return failure('比赛 ID 无效', 400)
  try {
    const result = matchId
      ? await env.DB.prepare('SELECT id, match_id, scope, fight_index, model, status, step, total, error, created_at, updated_at FROM analysis_jobs WHERE match_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 20').bind(matchId).all()
      : await env.DB.prepare('SELECT id, match_id, scope, fight_index, model, status, step, total, error, created_at, updated_at FROM analysis_jobs ORDER BY created_at DESC, rowid DESC LIMIT 20').all()
    return Response.json({ jobs: result.results || [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return failure('后台任务暂时无法读取', 503) }
}
