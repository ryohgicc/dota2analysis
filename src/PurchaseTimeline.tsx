import { useState } from 'react'
import { Target } from 'lucide-react'
import { clock, heroImage, heroNames, playerName, timeline, type Match, type MatchPlayer } from './data'
import { itemImage, itemName } from './locale'

type Purchase = NonNullable<MatchPlayer['purchase_log']>[number]
const bucketSeconds = 300
const isConsumable = (key: string) => /^(?:tpscroll|ward_|sentry|observer|dust|smoke_of_deceit|clarity|flask|tango|enchanted_mango|faerie_fire|blood_grenade|branches|recipe|bottle|infused_raindrop)/.test(key)
const inBucket = (time: number, end: number) => Number.isFinite(time) && time >= end - bucketSeconds && time < end

export function PurchaseTimeline({ match }: { match: Match }) {
  const [showConsumables, setShowConsumables] = useState(false)
  const players = [...match.players].sort((a, b) => a.player_slot - b.player_slot)
  const objectives = timeline(match).filter(event => event.type === 'objective' && Number.isFinite(event.time))
  const ends = Array.from({ length: Math.max(1, Math.ceil(match.duration / bucketSeconds) + 1) }, (_, index) => index * bucketSeconds)
  const hasPurchases = players.some(player => player.purchase_log?.length)
  return <article className="surface review-card purchase-timeline-card" id="match-purchases">
    <div className="purchase-timeline-heading"><div className="review-title"><Target size={18}/><div><span className="section-index">04 / ITEMS & OBJECTIVES</span><h3>购买记录与地图目标</h3></div></div><label className="purchase-toggle"><input type="checkbox" checked={showConsumables} onChange={event => setShowConsumables(event.target.checked)}/><span>显示消耗品</span></label></div>
    <p className="review-intro">按 5 分钟查看双方英雄的购买记录和地图目标。横向滚动可查看整场比赛；悬停物品可查看购买时间。</p>
    {!hasPurchases && !objectives.length ? <p className="review-empty">暂无解析数据，无法展示购买与目标时间。</p> : <div className="purchase-grid-scroll" role="region" aria-label="购买记录与地图目标时间表" tabIndex={0}>{(['radiant', 'dire'] as const).map(side => <section className={`purchase-team ${side}`} key={side} aria-label={`${side === 'radiant' ? '天辉' : '夜魇'}购买记录`}><h4>{side === 'radiant' ? '天辉' : '夜魇'} · 购买记录 {match.radiant_win === (side === 'radiant') && <span>获胜方</span>}</h4><table className="purchase-grid"><thead><tr><th scope="col" className="purchase-hero-column">玩家</th>{ends.map(end => <th scope="col" key={end}>{end / 60}′</th>)}</tr></thead><tbody><FragmentTeam side={side} players={players.filter(player => (player.player_slot < 128) === (side === 'radiant'))} objectives={objectives.filter(event => event.side === side)} ends={ends} showConsumables={showConsumables}/></tbody></table></section>)}</div>}
    <div className="review-foot">每列显示该刻度之前 5 分钟的购买；0′列包含赛前 5 分钟。购买时间不代表装备已合成或实际使用。<a href="#chronicle">查看逐条比赛时间轴 ↓</a></div>
  </article>
}

function FragmentTeam({ side, players, objectives, ends, showConsumables }: { side: 'radiant' | 'dire'; players: MatchPlayer[]; objectives: ReturnType<typeof timeline>; ends: number[]; showConsumables: boolean }) {
  return <>{players.map(player => <tr className={`purchase-player-row ${side}`} key={player.player_slot}><th scope="row" className="purchase-hero-column"><span className="purchase-hero"><img src={heroImage(player.hero_id)} alt="" loading="lazy"/><span><strong>{heroNames[player.hero_id]?.name || `英雄 ${player.hero_id}`}</strong><small>{playerName(player)}</small></span></span></th>{ends.map(end => <td key={end}><div className="purchase-items">{(player.purchase_log || []).filter((purchase: Purchase) => inBucket(purchase.time, end) && typeof purchase.key === 'string' && (showConsumables || !isConsumable(purchase.key))).map((purchase, index) => <span className="purchase-icon" title={`${clock(purchase.time)} · ${playerName(player)}购买${itemName(purchase.key)}`} key={`${purchase.time}-${purchase.key}-${index}`}><img src={itemImage(purchase.key)} alt={`${clock(purchase.time)} ${itemName(purchase.key)}`} loading="lazy" onError={event => { event.currentTarget.parentElement!.style.display = 'none' }}/><small aria-hidden="true">{clock(purchase.time)}</small></span>)}</div></td>)}</tr>)}<tr className={`purchase-objective-row ${side}`}><th scope="row" className="purchase-hero-column"><span className="purchase-objective-label"><Target size={15}/>{side === 'radiant' ? '天辉' : '夜魇'} · 地图目标</span></th>{ends.map(end => <td key={end}><div className="purchase-objectives">{objectives.filter(event => inBucket(event.time, end)).map(event => <span title={`${clock(event.time)} · ${event.title} · ${event.detail}`} key={event.id}><small>{clock(event.time)}</small>{event.detail === event.title ? event.title : event.detail}</span>)}</div></td>)}</tr></>
}
