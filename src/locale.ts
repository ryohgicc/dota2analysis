import itemNames from './items-zh.json'
import abilityNames from './abilities-zh.json'

const names: Record<string, string> = itemNames

export function itemName(key: string) {
  const clean = key.replace(/^item_/, '')
  const mapped = names[clean]
  if (mapped && /[\u3400-\u9fff]/.test(mapped)) return mapped
  if (clean.startsWith('recipe_')) {
    const base = names[clean.slice('recipe_'.length)]
    if (base && /[\u3400-\u9fff]/.test(base)) return `图纸（${base}）`
  }
  return `未收录物品（${clean}）`
}

export function objectiveName(key: string) {
  const tower = /^npc_dota_(goodguys|badguys)_tower(\d+)_(top|mid|bot)$/.exec(key)
  const barracks = /^npc_dota_(goodguys|badguys)_(melee|range)_rax_(top|mid|bot)$/.exec(key)
  const side = key.includes('_goodguys_') ? '天辉' : '夜魇'
  const lanes: Record<string, string> = { top: '上路', mid: '中路', bot: '下路' }
  if (tower) return `${side}${lanes[tower[3]]}${tower[2]} 塔`
  if (barracks) return `${side}${lanes[barracks[3]]}${barracks[2] === 'melee' ? '近战' : '远程'}兵营`
  return `未收录目标（${key}）`
}

export const itemImage = (key: string) => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${encodeURIComponent(key.replace(/^item_/, ''))}.png`

export function abilityName(key: string) {
  return (abilityNames as Record<string, string>)[key] || `未收录技能（${key}）`
}
export const abilityImage = (key: string) => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/abilities/${encodeURIComponent(key)}.png`
