import { useEffect, useState } from 'react'
import { Activity, BarChart3, LoaderCircle, Shield } from 'lucide-react'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { getMatches, won, type RecentMatch } from './data'
import { recentStats, WINDOWS, type WindowSize } from './recentStats'

export function RecentStats({ id }: { id: string }) {
  const [window, setWindow] = useState<WindowSize>(20)
  const [state, setState] = useState<{ data: RecentMatch[]; loading: boolean; error?: string }>({ data: [], loading: true })
  useEffect(() => {
    let active = true
    setWindow(20)
    setState({ data: [], loading: true })
    getMatches(id, { limit: 100 }).then(data => { if (active) setState({ data, loading: false }) }).catch(error => { if (active) setState({ data: [], loading: false, error: error.message }) })
    return () => { active = false }
  }, [id])
  const stats = recentStats(state.data, window)
  return <section className="detail-section recent-stats" aria-labelledby="recent-stats-title">
    <div className="section-heading"><div><span className="section-index">RECENT PERFORMANCE</span><h2 id="recent-stats-title">近期表现 · 五维图</h2><p>以最近的公开比赛为样本，比较不同场次数量下的表现。</p></div></div>
    <div className="surface recent-stats-surface">
      <div className="stats-toolbar"><div className="stats-tabs" role="group" aria-label="近期比赛统计场数">{WINDOWS.map(size => <button type="button" key={size} className={window === size ? 'active' : ''} aria-pressed={window === size} onClick={() => setWindow(size)}>近 {size} 场</button>)}</div><span className="stats-source"><Activity size={14}/> 公开比赛 · 全部模式</span></div>
      {state.loading ? <div className="recent-stats-state"><LoaderCircle className="spin" size={22}/> 正在统计近期比赛...</div> : state.error ? <div className="recent-stats-state"><Shield size={22}/> {state.error}</div> : !stats.count ? <div className="recent-stats-state"><BarChart3 size={22}/> 暂无可统计的公开比赛</div> : <>
        {stats.count < window && <p className="stats-coverage">目前只有 {stats.count} 场可用的公开比赛，本次统计按实际 {stats.count} 场计算。</p>}
        <div className="stats-content"><div className="stats-breakdown"><div className="stats-headline"><div><small>近 {window} 场胜率</small><strong>{stats.winRate}%</strong><span>{stats.wins} 胜 · {stats.losses} 负</span></div><div className="stats-record" aria-label={`最近 ${stats.count} 场胜负记录`}>{state.data.slice(0, window).map((game, index) => <span key={`${game.match_id}-${index}`} title={`第 ${index + 1} 场：${won(game) ? '胜利' : '失败'}`} className={won(game) ? 'won' : 'lost'}/>)}</div></div>
          <div className="recent-metrics"><div><small>场均击杀</small><strong>{stats.avgKills.toFixed(1)}</strong></div><div><small>场均死亡</small><strong>{stats.avgDeaths.toFixed(1)}</strong></div><div><small>场均助攻</small><strong>{stats.avgAssists.toFixed(1)}</strong></div><div><small>综合 KDA</small><strong>{stats.kda.toFixed(2)}</strong></div><div><small>使用英雄</small><strong>{stats.uniqueHeroes}</strong></div></div><p className="stats-method">KDA = 总击杀与助攻之和 ÷ 总阵亡（零阵亡时分母取 1）。这些数字仅统计已返回的公开比赛。</p>
        </div><div className="star-chart"><div className="star-chart-header"><strong>五维表现</strong><span>图形刻度 0—100 · 自定义换算</span></div><div className="star-chart-canvas" role="img" aria-label={`近 ${window} 场五维图：${stats.axes.map(axis => `${axis.label} ${axis.score}`).join('，')}`}><ResponsiveContainer width="100%" height="100%"><RadarChart data={stats.axes} outerRadius="65%"><PolarGrid stroke="#e5ebe5"/><PolarAngleAxis dataKey="label" tick={{ fill: '#607268', fontSize: 11 }}/><PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false}/><Radar dataKey="score" isAnimationActive={false} stroke="#c99c67" fill="#d7ad76" fillOpacity={0.34} strokeWidth={2} dot={{r: 3, fill: '#bc8f5b'}}/><Tooltip formatter={(value, _name, props) => [`${props.payload.value}（换算值 ${value}/100）`, props.payload.label]} contentStyle={{ border: '1px solid #e5ebe5', borderRadius: 8, fontSize: 11 }}/></RadarChart></ResponsiveContainer></div><div className="star-chart-values">{stats.axes.map(axis => <div key={axis.label}><span>{axis.label}</span><strong>{axis.value}</strong></div>)}</div></div></div>
        <details className="stats-rules"><summary>查看五星图换算规则</summary><div>{stats.axes.map(axis => <p key={axis.label}><strong>{axis.label}：</strong>{axis.rule}</p>)}<p>各维度封顶 100，仅用于同一套刻度下观察趋势；并非 OpenDota 官方评分，也不能直接代表个人对胜负的贡献。</p></div></details>
      </>}
    </div>
  </section>
}
