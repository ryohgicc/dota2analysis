import { won, type RecentMatch } from './data'

export const WINDOWS = [5, 10, 20, 100] as const
export type WindowSize = typeof WINDOWS[number]

const positive = (value: number) => Number.isFinite(value) && value >= 0 ? value : 0
const percent = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 100)

export function recentStats(matches: RecentMatch[], window: WindowSize) {
  const games = matches.slice(0, window)
  const count = games.length
  const wins = games.filter(won).length
  const kills = games.reduce((sum, game) => sum + positive(game.kills), 0)
  const deaths = games.reduce((sum, game) => sum + positive(game.deaths), 0)
  const assists = games.reduce((sum, game) => sum + positive(game.assists), 0)
  const uniqueHeroes = new Set(games.map(game => game.hero_id).filter(Number.isFinite)).size
  const avgKills = count ? kills / count : 0
  const avgDeaths = count ? deaths / count : 0
  const avgAssists = count ? assists / count : 0
  return {
    count, requested: window, wins, losses: count - wins,
    winRate: count ? percent(wins / count) : 0,
    avgKills, avgDeaths, avgAssists,
    kda: count ? (kills + assists) / Math.max(1, deaths) : 0,
    uniqueHeroes,
    axes: [
      { label: '胜率', score: count ? percent(wins / count) : 0, value: `${count ? percent(wins / count) : 0}%`, rule: '胜场 / 实际场次' },
      { label: '击杀', score: percent(avgKills / 15), value: `${avgKills.toFixed(1)} / 场`, rule: '场均 15 次为图形上限' },
      { label: '助攻', score: percent(avgAssists / 25), value: `${avgAssists.toFixed(1)} / 场`, rule: '场均 25 次为图形上限' },
      { label: '生存', score: count ? percent(1 - avgDeaths / 15) : 0, value: `${avgDeaths.toFixed(1)} 次阵亡 / 场`, rule: '场均 0 次阵亡为满格，15 次为零' },
      { label: '英雄覆盖', score: count ? percent(uniqueHeroes / Math.min(count, 10)) : 0, value: `${uniqueHeroes} 位`, rule: `不同英雄数 / ${Math.min(count, 10)}，上限 100%` }
    ]
  }
}
