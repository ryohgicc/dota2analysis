type Env = { OPEN_DOTA_API_KEY?: string }
export const onRequestPost: PagesFunction<Env> = async ({ params, env }) => {
  const id = String(params.id || '')
  if (!/^\d{1,20}$/.test(id)) return Response.json({ error: '请输入有效的数字比赛 ID' }, { status: 400 })
  try {
    const upstream = await fetch(`https://api.opendota.com/api/request/${id}${env?.OPEN_DOTA_API_KEY ? `?api_key=${encodeURIComponent(env?.OPEN_DOTA_API_KEY || '')}` : ''}`, { method: 'POST', signal: AbortSignal.timeout(15000), redirect: 'manual' })
    if (!upstream.ok) return Response.json({ error: upstream.status === 429 ? 'OpenDota 请求频繁，请稍后再试' : `OpenDota 无法受理解析请求 (${upstream.status})` }, { status: upstream.status === 429 ? 429 : 502 })
    const result = await upstream.json() as { error?: string; job?: { jobId?: number }; jobId?: number } | null
    if (!result || result.error) return Response.json({ error: 'OpenDota 无法受理解析请求，请稍后再试' }, { status: 502 })
    return Response.json({ submitted: true, jobId: result.job?.jobId ?? result.jobId ?? null })
  } catch { return Response.json({ error: '无法提交到 OpenDota，请稍后再试' }, { status: 502 }) }
}
