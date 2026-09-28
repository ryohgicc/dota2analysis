import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Clock3, Crosshair, FileText, Shield, Swords } from 'lucide-react'
import { heroNames, playerName, type Match } from './data'
import { MatchPlayerName } from './MatchPlayerName'
import { PurchaseTimeline } from './PurchaseTimeline'
import { coverage, fightReviews, goldTurns, laning, minute, sideLabel, sideOf, signed, turnContext } from './review'

const unknown = '暂无解析数据'
export function ReviewOverview({ match, onFight }: { match: Match; onFight: (index: number) => void }) {
  const [showAllFights, setShowAllFights] = useState(false)
  const availability = coverage(match)
  const turns = goldTurns(match)
  const lanes = laning(match)
  const fights = fightReviews(match)
  const losingSide = match.radiant_win ? 'dire' : 'radiant'
  const bigFights = showAllFights ? fights : [...fights].sort((a, b) => Math.abs(b.radiantGold - b.direGold) - Math.abs(a.radiantGold - a.direGold)).slice(0, 4).sort((a, b) => a.start - b.start)
  return <section className="overview-section" aria-label="全场复盘线索">
    <div className="section-heading"><div><span className="section-index">THE STORY BEHIND THE RESULT</span><h2>全场复盘线索</h2><p>先观察数据如何变化，再判断哪些决策值得回看。</p></div><span className="review-loser">本场败方 · {sideLabel(losingSide)}</span></div>
    <div className="coverage-strip"><Shield size={16}/><span>证据覆盖</span><span className={availability.laning ? 'available' : 'unavailable'}>10 分钟发育 {availability.laning ? '✓' : '—'}</span><span className={availability.economic ? 'available' : 'unavailable'}>经济拐点 {availability.economic ? '✓' : '—'}</span><span className={availability.fights ? 'available' : 'unavailable'}>团战 {availability.fights ? '✓' : '—'}</span><span className={availability.objectives ? 'available' : 'unavailable'}>地图目标 {availability.objectives ? '✓' : '—'}</span><span className="unavailable">位置与完整视野 —</span></div>
    <div className="review-cards">
      <article className="surface review-card"><div className="review-title"><Crosshair size={18}/><div><span className="section-index">01 / LANING</span><h3>对线与早期发育</h3></div></div><p className="review-intro">比较 10 分钟时每人的经济、经验和补刀；对线效率只是一个参考指标。</p>{availability.laning ? <div className="lane-table"><div className="lane-table-head"><span>玩家 · 英雄</span><span>经济</span><span>经验</span><span>补刀</span><span>效率</span></div>{lanes.map(({ player, gold10, xp10, lh10, laneEfficiency }) => <div className="lane-table-row" key={player.player_slot}><div><i className={`side-chip ${sideOf(player.player_slot)}`}/><MatchPlayerName player={player}/><small>{heroNames[player.hero_id]?.name || `英雄 ${player.hero_id}`}</small></div><span>{gold10?.toLocaleString() ?? '—'}</span><span>{xp10?.toLocaleString() ?? '—'}</span><span>{lh10 ?? '—'}</span><span>{laneEfficiency === undefined ? '—' : `${laneEfficiency}%`}</span></div>)}</div> : <p className="review-empty">{unknown}，仅可查看赛后数据。</p>}</article>
      <article className="surface review-card"><div className="review-title"><ArrowUpRight size={18}/><div><span className="section-index">02 / ECONOMY</span><h3>经济变化最大的三个区间</h3></div></div><p className="review-intro">按连续 3 分钟天辉经济优势变化的绝对值排序，区间互不重叠；这是筛查线索，不等于直接原因。</p>{turns.length ? <div className="turn-list">{turns.map(t => <div className="turn-row" key={t.startMinute}><span className="turn-time">{t.startMinute}′—{t.endMinute}′</span><span><strong>{t.change > 0 ? '经济差向天辉移动' : t.change < 0 ? '经济差向夜魇移动' : '差距未变'}</strong><small>天辉优势 {signed(t.before)} → {signed(t.after)}</small>{turnContext(match, t.startMinute, t.endMinute).length > 0 && <small className="turn-context">同期事件：{turnContext(match, t.startMinute, t.endMinute).slice(0, 4).map(e => `${minute(e.time)} ${e.label}`).join(" · ")}</small>}</span><b className={t.change >= 0 ? 'radiant-color' : 'dire-color'}>{signed(t.change)}</b></div>)}</div> : <p className="review-empty">{unknown}，无法判断经济何时发生明显变化。</p>}<div className="review-foot">击杀与目标若发生在同一时间段，只能证明时间相邻，不能仅据此认定因果。</div></article>
      <article className="surface review-card"><div className="review-title"><Swords size={18}/><div><span className="section-index">03 / FIGHTS → OBJECTIVES</span><h3>团战与后续目标</h3></div></div><p className="review-intro">团战记录逐人阵亡与经济变化，并查看结束后 3 分钟内的建筑、肉山或地图首领事件。</p>{fights.length ? <><div className="fight-list">{bigFights.map(f => <button key={f.index} className="fight-summary" onClick={() => onFight(f.index)}><span className="fight-time"><Clock3 size={13}/> {minute(f.start)}</span><span className="fight-facts"><strong>阵亡 天辉 {f.radiantDeaths} / 夜魇 {f.direDeaths}</strong><small>经济变化 天辉 {signed(f.radiantGold)} · 夜魇 {signed(f.direGold)}</small>{f.after.length ? <small className="objective-events">后续目标：{f.after.map(o => `${minute(o.time)} ${o.side ? sideLabel(o.side) : '阵营未知'}${o.label}`).join('、')}</small> : <small>窗口内无记录的主要目标</small>}</span><ArrowUpRight size={16}/></button>)}</div>{fights.length > 4 && <button className="show-more" onClick={() => setShowAllFights(!showAllFights)}>{showAllFights ? '收起团战' : `查看全部 ${fights.length} 场团战`}</button>}</> : <p className="review-empty">{unknown}，无法比较团战代价。</p>}<div className="review-foot">3 分钟窗口仅展示时间顺序；没有目标记录不能断言“未推进”或“决策失误”。</div></article>
      <PurchaseTimeline match={match}/>
    </div><p className="overview-note"><FileText size={15}/> 当前没有完整的英雄位置、当时可见的视野或语音沟通。上面的指标能定位值得复看的阶段，无法单独证明某位玩家的意图或责任。</p>
  </section>
}
