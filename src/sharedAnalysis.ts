export type SharedAnalysis = { match_id: string; scope: 'whole' | 'event'; fight_index: number; content: string; model: string; created_at: string; updated_at: string }
const request = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, init)
  const body = await response.json().catch(() => ({})) as Record<string, any>
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : '共享分析服务暂时不可用')
  return body as { analysis: SharedAnalysis | null }
}
export const getSharedAnalysis = (matchId: number, scope: 'whole' | 'event', fightIndex?: number) => request(`/api/analyses/${matchId}?scope=${scope}${scope === 'event' && Number.isInteger(fightIndex) ? `&fightIndex=${fightIndex}` : ''}`)
export const saveSharedAnalysis = (matchId: number, scope: 'whole' | 'event', content: string, model: string, fightIndex?: number) => request(`/api/analyses/${matchId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope, fightIndex, content, model }) })

export const getAnalysisHistory = async (limit = 20): Promise<SharedAnalysis[]> => {
  const response = await fetch(`/api/analyses?limit=${Math.min(Math.max(Math.floor(limit), 1), 50)}`)
  const body = await response.json().catch(() => ({})) as Record<string, any>
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : '分析历史暂时不可用')
  return Array.isArray(body?.analyses) ? body.analyses as SharedAnalysis[] : []
}
