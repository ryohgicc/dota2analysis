import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LoaderCircle, Users } from 'lucide-react'
import { getRecentTeammates, teammateCacheKey, type Teammate } from './teammateStats'
import { readPlayerCache } from './playerCache'
import { EnemyBadge } from './EnemyBadge'

type TeammateData = { teammates: Teammate[]; games: number; details: number; expectedDetails: number }
type State = { id: string; data?: TeammateData; loading: boolean; error?: string }

export function RecentTeammates({ id }: { id: string }) {
  const read = (playerId: string) => readPlayerCache<TeammateData>(teammateCacheKey(playerId))
  const [state, setState] = useState<State>(() => ({ id, data: read(id), loading: read(id) === undefined }))
  useEffect(() => {
    let active = true
    const cached = read(id)
    if (cached) { setState({ id, data: cached, loading: false }); return () => { active = false } }
    setState({ id, loading: true })
    getRecentTeammates(id).then(data => { if (active) setState({ id, data, loading: false }) }).catch(error => { if (active) setState({ id, loading: false, error: error.message }) })
    return () => { active = false }
  }, [id])
  const current = state.id === id ? state : { id, data: read(id), loading: read(id) === undefined }
  return <section className="detail-section recent-teammates" aria-labelledby="recent-teammates-title">
    <div className="section-heading"><div><span className="section-index">RECENT TEAMMATES</span><h2 id="recent-teammates-title">近期队友</h2><p>最近 50 场公开比赛中，同队至少 3 场的玩家；胜率按共同出场的比赛计算。</p>{current.data && current.data.details < current.data.expectedDetails && <small className="teammates-warning">部分比赛详情不可用，仇人标识仅在样本完整时显示。</small>}</div></div>
    <div className="surface">{current.loading ? <div className="teammates-state"><LoaderCircle className="spin" size={20}/> 正在统计近期队友（最多 50 场）...</div> : current.error ? <div className="teammates-state" role="alert">统计失败：{current.error}</div> : !current.data?.teammates.length ? <div className="teammates-state"><Users size={20}/> {current.data?.games ? '没有同队至少 3 场的公开账号玩家。' : '暂无公开比赛。'}</div> : <><div className="teammates-header"><span>队友</span><span>同队场次</span><span>共同胜率</span></div>{current.data.teammates.map(teammate => <div className="teammates-row" key={teammate.accountId}><span className="teammate-name-line"><Link to={`/players/${teammate.accountId}`}>{teammate.name}</Link><EnemyBadge reasons={teammate.enemyRules}/></span><span>{teammate.games} 场</span><strong>{teammate.winRate}% <small>({teammate.wins} 胜)</small></strong></div>)}</>}
    </div>
  </section>
}
