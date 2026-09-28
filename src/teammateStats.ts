import { getMatch, getMatches, type Match, type RecentMatch } from './data'
import { cachedPlayerRequest, playerCacheKey } from './playerCache'

export const enemyRules = [
  '最近 20 场中，和当前用户同场时胜率低于不同场时胜率',
  '和当前用户最近 10 场中，至少 3 场死亡数超过 10',
  '和当前用户最近 10 场胜率低于 30%'
] as const

export type Teammate = { accountId: number; name: string; games: number; wins: number; winRate: number; enemyRules: string[] }
type TeammateBase = { accountId: number; name: string; games: number; wins: number }

const validAccount = (accountId: unknown) => Number.isInteger(accountId) && Number(accountId) > 0 && Number(accountId) <= 4294967295
const sameSide = (playerSlot: number, currentSlot: number) => (playerSlot < 128) === (currentSlot < 128)

function enemyReasons(id: string, teammate: TeammateBase, recent: RecentMatch[], details: Match[], opponentRecent: RecentMatch[], complete = true) {
  if (!complete) return []
  const sharedIds = new Set(recent.map(game => game.match_id))
  const withCurrent = opponentRecent.slice(0, 20).filter(game => sharedIds.has(game.match_id))
  const withoutCurrent = opponentRecent.slice(0, 20).filter(game => !sharedIds.has(game.match_id))
  const withWinRate = withCurrent.length ? withCurrent.filter(game => (game.player_slot < 128) === game.radiant_win).length / withCurrent.length : 0
  const withoutWinRate = withoutCurrent.length ? withoutCurrent.filter(game => (game.player_slot < 128) === game.radiant_win).length / withoutCurrent.length : 0
  const sharedDetails = details.filter(match => sharedIds.has(match.match_id)).sort((a, b) => b.start_time - a.start_time).slice(0, 10)
  const sharedGames = sharedDetails.flatMap(match => {
    const player = match.players.find(candidate => String(candidate.account_id) === String(teammate.accountId))
    const current = match.players.find(candidate => String(candidate.account_id) === id)
    return player && current && sameSide(player.player_slot, current.player_slot) ? [{ match, player }] : []
  })
  const reasons = [
    withCurrent.length > 0 && withoutCurrent.length > 0 && withWinRate < withoutWinRate,
    sharedGames.length >= 10 && sharedGames.filter(game => game.player.deaths > 10).length >= 3,
    sharedGames.length >= 10 && sharedGames.filter(game => (game.player.player_slot < 128) === game.match.radiant_win).length / sharedGames.length < 0.3
  ].flatMap((earned, index) => earned ? [enemyRules[index]] : [])
  return reasons
}

export function summarizeTeammates(id: string, recent: RecentMatch[], details: Match[], opponentMatches = new Map<number, RecentMatch[]>(), complete = true): Teammate[] {
  const byMatch = new Map(details.map(match => [match.match_id, match]))
  const players = new Map<number, TeammateBase>()
  const seen = new Set<number>()
  for (const game of recent.slice(0, 50)) {
    if (seen.has(game.match_id)) continue
    seen.add(game.match_id)
    const match = byMatch.get(game.match_id)
    if (!match?.players?.length) continue
    const radiant = game.player_slot < 128
    const won = match.radiant_win === radiant
    for (const player of match.players) {
      const accountId = player.account_id
      if (!validAccount(accountId) || String(accountId) === id || (player.player_slot < 128) !== radiant) continue
      const numericAccountId = Number(accountId)
      const current = players.get(numericAccountId) || { accountId: numericAccountId, name: `玩家 ${accountId}`, games: 0, wins: 0 }
      current.games++
      if (won) current.wins++
      if (player.personaname) current.name = player.personaname
      players.set(numericAccountId, current)
    }
  }
  return [...players.values()].filter(player => player.games >= 3).map(player => {
    const reasons = enemyReasons(id, player, recent, details, opponentMatches.get(player.accountId) || [], complete)
    return { ...player, winRate: Math.round(player.wins / player.games * 100), enemyRules: reasons }
  }).sort((a, b) => b.games - a.games || b.wins - a.wins || a.accountId - b.accountId)
}

export const teammateCacheKey = (id: string) => playerCacheKey('teammates', id, 'limit=50')

export const getRecentTeammates = (id: string) => cachedPlayerRequest(teammateCacheKey(id), async () => {
  const recent = (await getMatches(id, { limit: 50 })).slice(0, 50)
  const details: Match[] = []
  let next = 0
  await Promise.all(Array.from({ length: Math.min(3, recent.length) }, async () => {
    while (next < recent.length) {
      const game = recent[next++]
      try { details.push(await getMatch(String(game.match_id))) } catch { /* A missing match does not block other teammate data. */ }
    }
  }))
  const baseTeammates = summarizeTeammates(id, recent, details)
  const opponentMatches = new Map<number, RecentMatch[]>()
  let nextTeammate = 0
  await Promise.all(Array.from({ length: Math.min(3, baseTeammates.length) }, async () => {
    while (nextTeammate < baseTeammates.length) {
      const teammate = baseTeammates[nextTeammate++]
      try { opponentMatches.set(teammate.accountId, await getMatches(String(teammate.accountId), { limit: 20 })) } catch { opponentMatches.set(teammate.accountId, []) }
    }
  }))
  return { teammates: summarizeTeammates(id, recent, details, opponentMatches, details.length >= recent.length), games: recent.length, details: details.length, expectedDetails: recent.length }
})
