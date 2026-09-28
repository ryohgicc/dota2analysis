import { earnedTrumpetRules } from '../../src/trumpetRules'

type Env = { DB?: D1Database; OPEN_DOTA_API_KEY?: string }
type Match = { player_slot: number; radiant_win: boolean; kills: number; deaths: number; assists: number }
type Stored = { account_id: string; trumpet_count: number; rules: string; checked_at: string; status?: 'pending' | 'completed' | 'failed'; error?: string }

const validId = (value: unknown) => /^\d{1,20}$/.test(String(value ?? ''))
const today = () => new Date().toISOString().slice(0, 10)
const fetchMatches = async (accountId: string, apiKey?: string): Promise<Match[]> => {
  const query = new URLSearchParams({ limit: '10' })
  if (apiKey) query.set('api_key', apiKey)
  const response = await fetch(`https://api.opendota.com/api/players/${accountId}/matches?${query}`)
  if (!response.ok) throw Error('OpenDota 暂时不可用')
  const data = await response.json() as Match[] | { error?: string }
  if (!Array.isArray(data)) throw Error('OpenDota 返回数据无效')
  return data
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await request.json().catch(() => null) as { accountIds?: unknown } | null
  const accountIds = Array.isArray(body?.accountIds) ? [...new Set(body.accountIds.filter(validId).map(String))].slice(0, 10) : []
  if (!accountIds.length) return Response.json({ error: '没有有效的玩家账号' }, { status: 400 })
  const checkedDate = today()
  try {
    const results: Stored[] = []
    for (const accountId of accountIds) {
      if (!env.DB) {
        const rules = earnedTrumpetRules(await fetchMatches(accountId, env.OPEN_DOTA_API_KEY))
        results.push({ account_id: accountId, trumpet_count: rules.length, rules: JSON.stringify(rules), checked_at: new Date().toISOString(), status: 'completed' })
        continue
      }
      const existing = await env.DB.prepare('SELECT account_id, trumpet_count, rules, checked_at, status, error FROM player_trumpets WHERE account_id = ? AND checked_date = ?').bind(accountId, checkedDate).first<Stored>()
      if (existing) { results.push(existing); continue }
      const inserted = await env.DB.prepare('INSERT OR IGNORE INTO player_trumpets (account_id, checked_date, trumpet_count, rules, checked_at, status, error) VALUES (?, ?, 0, ?, ?, ?, ?)').bind(accountId, checkedDate, '[]', new Date().toISOString(), 'pending', '').run()
      if (!inserted.meta || inserted.meta.changes !== 1) {
        const raced = await env.DB.prepare('SELECT account_id, trumpet_count, rules, checked_at, status, error FROM player_trumpets WHERE account_id = ? AND checked_date = ?').bind(accountId, checkedDate).first<Stored>()
        if (raced) results.push(raced)
        continue
      }
      try {
        const rules = earnedTrumpetRules(await fetchMatches(accountId, env.OPEN_DOTA_API_KEY))
        const row = { trumpet_count: rules.length, rules: JSON.stringify(rules), checked_at: new Date().toISOString() }
        await env.DB.prepare('UPDATE player_trumpets SET trumpet_count = ?, rules = ?, checked_at = ?, status = ?, error = ? WHERE account_id = ? AND checked_date = ?').bind(row.trumpet_count, row.rules, row.checked_at, 'completed', '', accountId, checkedDate).run()
        results.push({ account_id: accountId, ...row, status: 'completed' })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'OpenDota 请求失败'
        await env.DB.prepare('UPDATE player_trumpets SET status = ?, error = ?, checked_at = ? WHERE account_id = ? AND checked_date = ?').bind('failed', message.slice(0, 120), new Date().toISOString(), accountId, checkedDate).run()
        results.push({ account_id: accountId, trumpet_count: 0, rules: '[]', checked_at: new Date().toISOString(), status: 'failed' })
      }
    }
    return Response.json({ results }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return Response.json({ error: '近期表现检测暂时不可用' }, { status: 503 }) }
}
