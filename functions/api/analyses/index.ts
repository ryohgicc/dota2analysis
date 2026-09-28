type Env = { DB: D1Database }

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const rawLimit = Number(url.searchParams.get('limit') || 20)
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 50) : 20
  try {
    const result = await env.DB.prepare(`SELECT match_id, scope, fight_index, content, model, created_at, updated_at FROM analyses ORDER BY updated_at DESC LIMIT ?`).bind(limit).all()
    return Response.json({ analyses: result.results || [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: '共享分析暂时不可用' }, { status: 503 })
  }
}
