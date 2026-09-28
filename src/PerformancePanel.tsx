import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, BarChart3, LoaderCircle, Shield } from 'lucide-react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { getMatches, won, type RecentMatch } from './data'
import { recentStats, WINDOWS, type WindowSize } from './recentStats'
import { playerCacheKey, readPlayerCache } from './playerCache'

export function RecentStats({ id, ownId }: { id: string; ownId: string }) {
  const [window, setWindow] = useState<WindowSize>(20)
  const [comparing, setComparing] = useState(false)
  type MatchState = { id: string; data: RecentMatch[]; loading: boolean; error?: string }
  const cachedMatches = (playerId: string) => readPlayerCache<RecentMatch[]>(playerCacheKey('matches', playerId, 'limit=100'))
  const [own, setOwn] = useState<MatchState>({ id: '', data: [], loading: false })
  const [state, setState] = useState<MatchState>(() => {
    const data = cachedMatches(id)
    return { id, data: data || [], loading: data === undefined }
  })
  useEffect(() => {
    let active = true
    setWindow(20)
    setComparing(false)
    const data = cachedMatches(id)
    if (data !== undefined) { setState({ id, data, loading: false }); return () => { active = false } }
    setState({ id, data: [], loading: true })
    getMatches(id, { limit: 100 }).then(data => { if (active) setState({ id, data, loading: false }) }).catch(error => { if (active) setState({ id, data: [], loading: false, error: error.message }) })
    return () => { active = false }
  }, [id])
  useEffect(() => {
    if (!comparing || !ownId || ownId === id) return
    let active = true
    const data = cachedMatches(ownId)
    if (data !== undefined) { setOwn({ id: ownId, data, loading: false }); return () => { active = false } }
    setOwn({ id: ownId, data: [], loading: true })
    getMatches(ownId, { limit: 100 }).then(data => { if (active) setOwn({ id: ownId, data, loading: false }) }).catch(error => { if (active) setOwn({ id: ownId, data: [], loading: false, error: error.message }) })
    return () => { active = false }
  }, [comparing, ownId, id])
  const current: MatchState = state.id === id ? state : (() => { const data = cachedMatches(id); return { id, data: data || [], loading: data === undefined } })()
  const ownCurrent: MatchState = own.id === ownId ? own : (() => { const data = ownId ? cachedMatches(ownId) : undefined; return { id: ownId, data: data || [], loading: data === undefined } })()
  const stats = recentStats(current.data, window)
  const ownStats = recentStats(ownCurrent.data, window)
  const comparison = comparing && ownId && ownId !== id
  const axes = stats.axes.map((axis, index) => ({ ...axis, ownScore: ownStats.axes[index].score, ownValue: ownStats.axes[index].value }))
  const rows = [
    ['胜率', `${stats.winRate}%`, `${ownStats.winRate}%`],
    ['场均击杀', stats.avgKills.toFixed(1), ownStats.avgKills.toFixed(1)],
    ['场均死亡', stats.avgDeaths.toFixed(1), ownStats.avgDeaths.toFixed(1)],
    ['场均助攻', stats.avgAssists.toFixed(1), ownStats.avgAssists.toFixed(1)],
    ['综合 KDA', stats.kda.toFixed(2), ownStats.kda.toFixed(2)],
    ['使用英雄', String(stats.uniqueHeroes), String(ownStats.uniqueHeroes)]
  ]
  return <section className="detail-section recent-stats" aria-labelledby="recent-stats-title">
    <div className="section-heading"><div><span className="section-index">RECENT PERFORMANCE</span><h2 id="recent-stats-title">近期表现 · 五维图</h2><p>以最近的公开比赛为样本，比较不同场次数量下的表现。</p></div></div>
    <div className="surface recent-stats-surface">
      <div className="stats-toolbar"><div className="stats-tabs" role="group" aria-label="近期比赛统计场数">{WINDOWS.map(size => <button type="button" key={size} className={window === size ? 'active' : ''} aria-pressed={window === size} onClick={() => setWindow(size)}>近 {size} 场</button>)}</div><div className="stats-toolbar-right"><span className="stats-source"><Activity size={14}/> 公开比赛 · 全部模式</span>{ownId && ownId !== id && <button type="button" className={`button small ${comparing ? 'primary' : 'outline'}`} aria-pressed={comparing} onClick={() => setComparing(value => !value)}>{comparing ? '关闭对比' : '和我对比'}</button>}{!ownId && <Link className="button small outline" to="/players">绑定我的账号以对比</Link>}</div></div>
      {current.loading ? <div className="recent-stats-state"><LoaderCircle className="spin" size={22}/> 正在统计近期比赛...</div> : current.error ? <div className="recent-stats-state"><Shield size={22}/> {current.error}</div> : !stats.count ? <div className="recent-stats-state"><BarChart3 size={22}/> 暂无可统计的公开比赛</div> : <>
        {stats.count < window && <p className="stats-coverage">目前只有 {stats.count} 场可用的公开比赛，本次统计按实际 {stats.count} 场计算。</p>}
        {comparison && (ownCurrent.loading ? <div className="compare-state">正在获取我的近期比赛...</div> : ownCurrent.error ? <div className="compare-state" role="alert">我的数据加载失败：{ownCurrent.error}。关闭并重新开启对比可重试。</div> : !ownStats.count ? <div className="compare-state">我的账号暂无可统计的公开比赛。</div> : <div className="compare-panel"><p>双方分别取各自最新的公开比赛（全部模式），并非同场对战；当前窗口：对方 {stats.count} 场 / 我 {ownStats.count} 场。样本不足时按实际场数计算。</p><div className="compare-table-wrap"><table className="compare-table"><thead><tr><th>指标</th><th>该玩家</th><th>我</th></tr></thead><tbody>{rows.map(([label, value, mine]) => <tr key={label}><th scope="row">{label}</th><td>{value}</td><td>{mine}</td></tr>)}</tbody></table></div></div>)}
        <div className="stats-content"><div className="stats-breakdown"><div className="stats-headline"><div><small>近 {window} 场胜率</small><strong>{stats.winRate}%</strong><span>{stats.wins} 胜 · {stats.losses} 负</span></div><div className="stats-record" aria-label={`最近 ${stats.count} 场胜负记录`}>{current.data.slice(0, window).map((game, index) => <span key={`${game.match_id}-${index}`} title={`第 ${index + 1} 场：${won(game) ? '胜利' : '失败'}`} className={won(game) ? 'won' : 'lost'}/>)}</div></div>
          <div className="recent-metrics"><div><small>场均击杀</small><strong>{stats.avgKills.toFixed(1)}</strong></div><div><small>场均死亡</small><strong>{stats.avgDeaths.toFixed(1)}</strong></div><div><small>场均助攻</small><strong>{stats.avgAssists.toFixed(1)}</strong></div><div><small>综合 KDA</small><strong>{stats.kda.toFixed(2)}</strong></div><div><small>使用英雄</small><strong>{stats.uniqueHeroes}</strong></div></div><p className="stats-method">KDA = 总击杀与助攻之和 ÷ 总阵亡（零阵亡时分母取 1）。这些数字仅统计已返回的公开比赛。</p>
        </div><div className="star-chart"><div className="star-chart-header"><strong>五维表现{comparison && !ownCurrent.loading && !ownCurrent.error && ownStats.count > 0 ? ' · 双人对比' : ''}</strong><span>图形刻度 0—100 · 自定义换算</span></div><div className="star-chart-canvas" role="img" aria-label={`近 ${window} 场五维图：该玩家 ${stats.axes.map(axis => `${axis.label} ${axis.score}`).join('，')}${comparison && ownStats.count && !ownCurrent.error && !ownCurrent.loading ? `；我 ${ownStats.axes.map(axis => `${axis.label} ${axis.score}`).join('，')}` : ''}`}><ResponsiveContainer width="100%" height="100%"><RadarChart data={axes} outerRadius="65%"><PolarGrid stroke="#e5ebe5"/><PolarAngleAxis dataKey="label" tick={{ fill: '#607268', fontSize: 11 }}/><PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false}/><Radar dataKey="score" name="该玩家" isAnimationActive={false} stroke="#c99c67" fill="#d7ad76" fillOpacity={0.34} strokeWidth={2} dot={{r: 3, fill: '#bc8f5b'}}/>{comparison && !ownCurrent.loading && !ownCurrent.error && ownStats.count > 0 && <Radar dataKey="ownScore" name="我" isAnimationActive={false} stroke="#5489af" fill="#5489af" fillOpacity={0.15} strokeWidth={2} dot={{r: 3, fill: '#5489af'}}/>}<Tooltip formatter={(value, name, props) => [`${name === '我' ? props.payload.ownValue : props.payload.value}（换算值 ${value}/100）`, `${props.payload.label} · ${name}`]} contentStyle={{ border: '1px solid #e5ebe5', borderRadius: 8, fontSize: 11 }}/></RadarChart></ResponsiveContainer></div>{comparison && !ownCurrent.loading && !ownCurrent.error && ownStats.count > 0 && <div className="compare-legend"><span>● 该玩家</span><span>● 我</span></div>}<div className="star-chart-values">{stats.axes.map(axis => <div key={axis.label}><span>{axis.label}</span><strong>{axis.value}</strong></div>)}</div></div></div>
        <details className="stats-rules"><summary>查看五星图换算规则</summary><div>{stats.axes.map(axis => <p key={axis.label}><strong>{axis.label}：</strong>{axis.rule}</p>)}<p>各维度封顶 100，仅用于同一套刻度下观察趋势；并非 OpenDota 官方评分，也不能直接代表个人对胜负的贡献。</p></div></details>
      </>}
    </div>
  </section>
}
