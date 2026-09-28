import { evidenceChunks } from './aiBatch'

type Scope = 'whole' | 'event'
type Settings = { baseUrl: string; apiKey: string; model: string; language: string }
export type AnalysisJob = { id: string; match_id: string; scope: Scope; fight_index: number; model: string; status: 'queued' | 'running' | 'completed' | 'failed'; step: number; total: number; error: string; created_at: string }

export async function startAnalysisJob({ evidence, settings, scope, prompt, matchId, fightIndex }: {
  evidence: unknown; settings: Settings; scope: Scope; prompt: string; matchId: number; fightIndex?: number
}): Promise<string> {
  const response = await fetch('/api/analysis-jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId: String(matchId), scope, fightIndex, baseUrl: settings.baseUrl, model: settings.model,
      apiKey: settings.apiKey, language: settings.language, prompt, chunks: evidenceChunks(evidence) }) })
  const body = await response.json().catch(() => ({})) as Record<string, any>
  if (!response.ok) throw Error(typeof body.error === 'string' ? body.error : '后台任务提交失败')
  return body.jobId as string
}

export async function getAnalysisJobs(matchId?: number): Promise<AnalysisJob[]> {
  const response = await fetch(`/api/analysis-jobs${matchId === undefined ? '' : `?matchId=${matchId}`}`, { cache: 'no-store' })
  const body = await response.json().catch(() => ({})) as Record<string, any>
  if (!response.ok) throw Error(typeof body.error === 'string' ? body.error : '后台任务暂时无法读取')
  return Array.isArray(body.jobs) ? body.jobs : []
}
