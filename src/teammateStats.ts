import { getMatches, getPeers, type Peer, type RecentMatch } from './data'
import { cachedPlayerRequest, playerCacheKey } from './playerCache'

export const enemyRules = [
  '最近 20 场中，和当前用户同场时胜率低于不同场时胜率',
  '和当前用户最近 10 场中，至少 3 场死亡数超过 10',
  '和当前用户最近 10 场胜率低于 30%'
] as const

export type Teammate = { accountId: number; name: string; games: number; wins: number; winRate: number; enemyRules: string[] }

const validAccount = (accountId: unknown) => Number.isInteger(accountId) && Number(accountId) > 0 && Number(accountId) <= 4294967295
const won = (game: RecentMatch) => (game.player_slot < 128) === game.radiant_win

export function summarizePeerTeammates(id: string, peers: Peer[], histories: Map<number, { recent: RecentMatch[]; shared: RecentMatch[] }> = new Map()): Teammate[] {
  return peers.filter(peer => validAccount(peer.account_id) && String(peer.account_id) !== id && Number(peer.with_games || 0) >= 3).map(peer => {
    const accountId = Number(peer.account_id)
    const games = Number(peer.with_games || 0)
    const wins = Number(peer.with_win || 0)
    const history = histories.get(accountId)
    const recent = history?.recent.slice(0, 20) || []
    const shared = history?.shared || []
    const sharedIds = new Set(shared.map(game => game.match_id))
    const withCurrent = recent.filter(game => sharedIds.has(game.match_id))
    const withoutCurrent = recent.filter(game => !sharedIds.has(game.match_id))
    const latestShared = shared.slice(0, 10)
    const reasons = [
      withCurrent.length > 0 && withoutCurrent.length > 0 && withCurrent.filter(won).length / withCurrent.length < withoutCurrent.filter(won).length / withoutCurrent.length,
      latestShared.length === 10 && latestShared.filter(game => game.deaths > 10).length >= 3,
      latestShared.length === 10 && latestShared.filter(won).length / 10 < 0.3
    ].flatMap((earned, index) => earned ? [enemyRules[index]] : [])
    return { accountId, name: peer.personaname || `玩家 ${accountId}`, games, wins, winRate: Math.round(wins / games * 100), enemyRules: reasons }
  }).sort((a, b) => b.games - a.games || b.wins - a.wins || a.accountId - b.accountId)
}

export const teammateCacheKey = (id: string) => playerCacheKey('teammates', id, 'peers=50')

export const getRecentTeammates = (id: string) => cachedPlayerRequest(teammateCacheKey(id), async () => {
  const peers = await getPeers(id, 50)
  const candidates = peers.filter(peer => validAccount(peer.account_id) && String(peer.account_id) !== id && Number(peer.with_games || 0) >= 3)
  const histories = new Map<number, { recent: RecentMatch[]; shared: RecentMatch[] }>()
  let missing = 0
  let next = 0
  await Promise.all(Array.from({ length: Math.min(3, candidates.length) }, async () => {
    while (next < candidates.length) {
      const accountId = Number(candidates[next++].account_id)
      try {
        const [recent, shared] = await Promise.all([
          getMatches(String(accountId), { limit: 20 }),
          getMatches(String(accountId), { limit: 20, included_account_id: id })
        ])
        histories.set(accountId, { recent, shared })
      } catch { missing++ }
    }
  }))
  return { teammates: summarizePeerTeammates(id, peers, histories), missing }
})
