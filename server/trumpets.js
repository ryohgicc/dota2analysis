const validId = value => /^\d{1,20}$/.test(String(value ?? ''))
const today = () => new Date().toISOString().slice(0, 10)
const ruleLabels = ['近 10 场胜率超过 80%', '近 10 场至少 6 场击杀达到 15', '近 10 场至少 3 场 KDA 达到 7.0', '近 10 场至少 4 场击杀达到 20', '近 10 场至少 5 场死亡数为 0 或 1']
const rulesFor = matches => {
  const games = matches.slice(0, 10)
  return [
    games.length === 10 && games.filter(game => (game.player_slot < 128) === game.radiant_win).length / 10 > 0.8,
    games.filter(game => game.kills >= 15).length > 5,
    games.filter(game => (game.kills + game.assists) / Math.max(1, game.deaths) >= 7).length >= 3,
    games.filter(game => game.kills >= 20).length > 3,
    games.filter(game => game.deaths === 0 || game.deaths === 1).length > 4
  ].flatMap((earned, index) => earned ? [ruleLabels[index]] : [])
}
export function createTrumpetChecker({ fetcher = fetch, store = new Map() } = {}) {
  return async accountIds => {
    const date = today()
    const results = []
    for (const accountId of [...new Set(accountIds.filter(validId))].slice(0, 10)) {
      const key = `${accountId}:${date}`
      if (store.has(key)) { results.push(store.get(key)); continue }
      try {
        const response = await fetcher(`https://api.opendota.com/api/players/${accountId}/matches?limit=10`)
        if (!response.ok) throw Error('OpenDota unavailable')
        const rules = rulesFor(await response.json())
        const row = { account_id: accountId, trumpet_count: rules.length, rules: JSON.stringify(rules), checked_at: new Date().toISOString(), status: 'completed' }
        store.set(key, row); results.push(row)
      } catch (error) {
        const row = { account_id: accountId, trumpet_count: 0, rules: '[]', checked_at: new Date().toISOString(), status: 'failed', error: error instanceof Error ? error.message : 'OpenDota unavailable' }
        store.set(key, row); results.push(row)
      }
    }
    return results
  }
}
