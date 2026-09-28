export type TrumpetMatch = { player_slot: number; radiant_win: boolean; kills: number; deaths: number; assists: number }

export const trumpetRules = [
  '近 10 场胜率超过 80%',
  '近 10 场至少 6 场击杀达到 15',
  '近 10 场至少 3 场 KDA 达到 7.0',
  '近 10 场至少 4 场击杀达到 20',
  '近 10 场至少 5 场死亡数为 0 或 1'
] as const

export function earnedTrumpetRules(matches: TrumpetMatch[]): string[] {
  const games = matches.slice(0, 10)
  return [
    games.length === 10 && games.filter(game => (game.player_slot < 128) === game.radiant_win).length / 10 > 0.8,
    games.filter(game => game.kills >= 15).length > 5,
    games.filter(game => (game.kills + game.assists) / Math.max(1, game.deaths) >= 7).length >= 3,
    games.filter(game => game.kills >= 20).length > 3,
    games.filter(game => game.deaths === 0 || game.deaths === 1).length > 4
  ].flatMap((earned, index) => earned ? [trumpetRules[index]] : [])
}
