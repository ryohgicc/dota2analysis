import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Bookmark, Check, ChevronDown, ChevronRight, Clock3, Crosshair, ExternalLink, FileText, Filter, Home, LoaderCircle, Menu, Plus, Search, Settings2, Shield, Sparkles, Swords, Target, Trash2, Trophy, UserRound, Users, X } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { clock, date, getHeroes, getMatch, getMatches, getPlayer, heroImage, heroNames, modeName, normalizeSteamId, playerName, requestMatchParse, requestTrumpets, short, timeline, won, type Event, type HeroStat, type Match, type RecentMatch } from './data'
import { ReviewOverview } from './ReviewOverview'
import { MatchScoreboard } from './MatchScoreboard'
import { FightBreakdown } from './FightBreakdown'
import { buildAnalysisEvidence } from './analysis'
import { getAnalysisJobs, startAnalysisJob, type AnalysisJob } from './analysisJobs'
import { itemImage } from './locale'
import { RecentStats } from './PerformancePanel'
import { TrumpetBadge } from './TrumpetBadge'
import { RecentTeammates } from './RecentTeammates'
import { MyAccount } from './MyAccount'
import { playerCacheKey, readPlayerCache } from './playerCache'
import { testAiConnection } from './aiConnection'
import { splitAiReview } from './aiReview'
import { getAnalysisHistory, getSharedAnalysis, saveSharedAnalysis, type SharedAnalysis } from './sharedAnalysis'
import './style.css'

type Settings = { baseUrl: string; model: string; language: string; apiKey: string; rememberApiKey: boolean }
type SavedSettings = Pick<Settings, 'baseUrl' | 'model' | 'language' | 'apiKey' | 'rememberApiKey'>
const defaultSettings: Settings = { baseUrl: 'https://api.openai.com/v1', model: '', language: '简体中文', apiKey: '', rememberApiKey: false }
const settingsStorageKey = 'insight-ai-settings'
const saved = <T,>(key: string, fallback: T): T => { try { return JSON.parse(localStorage.getItem(key) || '') as T } catch { return fallback } }
const savedSettings = (): Settings => {
  const stored = saved<Partial<SavedSettings>>(settingsStorageKey, {})
  return { ...defaultSettings, ...stored, rememberApiKey: stored.rememberApiKey === true, apiKey: stored.rememberApiKey === true && typeof stored.apiKey === 'string' ? stored.apiKey : '' }
}
const useQuery = <T,>(loader: () => Promise<T>, deps: unknown[], cacheKey?: string) => {
  const [state, set] = useState<{ key?: string; data?: T; error?: string; loading: boolean }>(() => {
    const data = cacheKey ? readPlayerCache<T>(cacheKey) : undefined
    return { key: cacheKey, data, loading: data === undefined }
  })
  useEffect(() => {
    let active = true
    const data = cacheKey ? readPlayerCache<T>(cacheKey) : undefined
    if (data !== undefined) { set({ key: cacheKey, data, loading: false }); return () => { active = false } }
    set({ key: cacheKey, loading: true })
    loader().then(data => { if (active) set({ key: cacheKey, data, loading: false }) }).catch(error => { if (active) set({ key: cacheKey, error: error.message, loading: false }) })
    return () => { active = false }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  if (cacheKey && state.key !== cacheKey) {
    const data = readPlayerCache<T>(cacheKey)
    return { data, loading: data === undefined, error: undefined }
  }
  return state
}
const Hero = ({ id, size = 'normal' }: { id: number; size?: 'normal' | 'large' }) => <img className={`hero-thumb ${size}`} src={heroImage(id)} alt={heroNames[id]?.name || `英雄 ${id}`} loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
const Loader = ({ label = '正在获取比赛数据...' }: { label?: string }) => <div className="state"><LoaderCircle className="spin" size={25} /><p>{label}</p></div>
const ErrorBox = ({ message }: { message: string }) => <div className="state"><Shield size={24} /><h3>暂时无法加载</h3><p>{message}</p><button className="button subtle" onClick={() => location.reload()}>重新加载</button></div>
const Empty = ({ title, text }: { title: string; text: string }) => <div className="empty"><Search size={30} /><h3>{title}</h3><p>{text}</p></div>

function Layout({ children, onSettings }: { children: React.ReactNode; onSettings: () => void }) {
  const [mobile, setMobile] = useState(false)
  return <div className="app-shell"><aside className={`sidebar ${mobile ? 'open' : ''}`}>
    <Link to="/" className="brand" onClick={() => setMobile(false)}><span className="brand-mark"><span>◈</span></span><span><strong>视界 <em>INSIGHT</em></strong><small>DOTA 2 MATCH ANALYTICS</small></span></Link>
    <div className="sidebar-section">工作空间</div><nav className="nav"><NavLink to="/" end onClick={() => setMobile(false)}><Home size={18} /> 总览</NavLink><NavLink to="/players" onClick={() => setMobile(false)}><Users size={18} /> 关注玩家</NavLink><NavLink to="/matches" onClick={() => setMobile(false)}><Swords size={18} /> 比赛复盘</NavLink></nav>
    <div className="sidebar-bottom"><div className="sidebar-tip"><span className="tip-icon"><Sparkles size={18} /></span><strong>看懂每一次转折</strong><p>用比赛数据与 AI 还原每个关键决策。</p></div><button className="sidebar-settings" onClick={() => { onSettings(); setMobile(false) }}><Settings2 size={18} /> AI 模型设置 <ChevronRight size={16} /></button><div className="sidebar-footer">数据由 OpenDota 提供 <span>·</span> 独立分析工具</div></div>
  </aside><div className="mobile-backdrop" onClick={() => setMobile(false)} style={{ display: mobile ? undefined : 'none' }} /><div className="page"><header className="topbar"><button className="mobile-menu icon-button" aria-label="打开菜单" onClick={() => setMobile(true)}><Menu size={22} /></button><div className="topbar-caption"><span className="topbar-dot" /> 比赛数据分析平台</div><div className="topbar-right"><span className="live-pill"><span /> LIVE DATA</span><button className="top-settings icon-button" onClick={onSettings} aria-label="AI 设置"><Settings2 size={19} /></button></div></header><main>{children}</main></div></div>
}
function SearchBox({ kind, placeholder, compact = false }: { kind: 'player' | 'match'; placeholder?: string; compact?: boolean }) {
  const [input, setInput] = useState(''); const [error, setError] = useState(''); const navigate = useNavigate()
  const submit = (e: React.FormEvent) => { e.preventDefault(); const value = kind === 'player' ? normalizeSteamId(input) : /^\d{1,20}$/.test(input.trim()) ? input.trim() : null; if (!value) { setError(kind === 'player' ? '请输入有效的 Steam 账号 ID（32 位或 64 位）' : '请输入有效的数字比赛 ID'); return } setError(''); navigate(kind === 'player' ? `/players/${value}` : `/matches/${value}`) }
  return <form className={`search-box ${compact ? 'compact' : ''}`} onSubmit={submit}><div className="search-field"><Search size={19} /><input aria-label={kind === 'player' ? '玩家 Steam ID' : '比赛 ID'} value={input} onChange={e => { setInput(e.target.value); setError('') }} placeholder={placeholder || (kind === 'player' ? '输入 Steam 账号 ID...' : '输入比赛 ID...')} /><button type="submit" aria-label="搜索"><ArrowRight size={18} /></button></div>{error && <small className="form-error">{error}</small>}</form>
}
function FollowCard({ id, onRemove }: { id: string; onRemove: (id: string) => void }) {
  const profile = useQuery(() => getPlayer(id), [id], playerCacheKey('profile', id)); const matches = useQuery(() => getMatches(id, { limit: 10 }), [id], playerCacheKey('matches', id, 'limit=10')); const p = profile.data?.profile; const latest = matches.data?.[0]; const wins = matches.data?.filter(won).length || 0
  return <div className="follow-card"><div className="follow-card-head"><div className="avatar">{p?.avatarfull ? <img src={p.avatarfull} alt="" /> : <Users size={21} />}</div><div className="follow-name"><div className="follow-name-line"><Link to={`/players/${id}`}>{p?.personaname || `玩家 ${id}`}</Link><TrumpetBadge matches={matches.data}/></div><small>ACCOUNT ID: {id}</small></div><button className="remove-btn" title="取消关注" aria-label={`取消关注 ${p?.personaname || id}`} onClick={() => onRemove(id)}><X size={16} /></button></div>{profile.loading || matches.loading ? <div className="card-loading"><LoaderCircle className="spin" size={17} /> 加载中</div> : profile.error || matches.error ? <p className="mini-error">{profile.error || matches.error}</p> : <><div className="follow-stats"><div><small>近 10 场胜率</small><strong>{matches.data?.length ? `${Math.round(wins / matches.data.length * 100)}%` : '—'}</strong></div><div><small>近期战绩</small><strong>{wins} <span className="win-text">胜</span> / {(matches.data?.length || 0) - wins} <span className="lose-text">负</span></strong></div></div><div className="follow-bottom"><span>{latest ? <>最近比赛 · {date(latest.start_time)}</> : '暂无公开比赛'}</span><Link to={`/players/${id}`} aria-label="查看玩家"><ArrowUpRight size={19} /></Link></div></>}</div>
}
function FollowGrid({ ids, remove }: { ids: string[]; remove: (id: string) => void }) { return ids.length ? <div className="follow-grid">{ids.map(id => <FollowCard key={id} id={id} onRemove={remove} />)}</div> : <Empty title="还没有关注玩家" text="在上方输入 Steam 账号 ID，即可开始追踪近期战绩。" /> }
function AnalysisHistory() {
  const [entries, setEntries] = useState<SharedAnalysis[]>([])
  const [jobs, setJobs] = useState<AnalysisJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const [nextEntries, nextJobs] = await Promise.all([getAnalysisHistory(20), getAnalysisJobs()])
        if (active) { setEntries(nextEntries); setJobs(nextJobs); setError(false) }
      } catch { if (active) setError(true) } finally { if (active) setLoading(false) }
    }
    void refresh()
    const timer = setInterval(refresh, 5000)
    return () => { active = false; clearInterval(timer) }
  }, [])
  return <section className="section-spaced analysis-history" aria-labelledby="analysis-history-title"><div className="section-heading"><div><span className="section-index">03 / AI ANALYSIS HISTORY</span><h2 id="analysis-history-title">AI 分析历史 <span className="count">{entries.length.toString().padStart(2, '0')}</span></h2><p>查看最近完成的整场与节点分析，点击即可回到对应比赛。</p></div><Link className="button small outline" to="/matches">分析新比赛 <ArrowRight size={16}/></Link></div><div className="surface analysis-history-list">{loading ? <Loader label="正在加载分析历史..."/> : error ? <p className="analysis-history-empty">分析历史暂时无法加载，请稍后重试。</p> : <>{jobs.filter(job => job.status === 'queued' || job.status === 'running' || job.status === 'failed').map(job => <Link key={job.id} className="analysis-history-item" to={`/matches/${job.match_id}${job.scope === 'event' ? `?fightIndex=${job.fight_index}` : ''}#match-ai`}>比赛 #{job.match_id} · {job.status === 'failed' ? `分析失败：${job.error}` : `后台分析中 ${job.step}/${job.total}`}</Link>)}{!entries.length && !jobs.length ? <Empty title="还没有 AI 分析" text="完成一场比赛的 AI 分析后，结果会显示在这里。" /> : entries.map(entry => <AnalysisHistoryItem key={`${entry.match_id}-${entry.updated_at}`} entry={entry}/>)}</>}</div></section>
}
function AnalysisHistoryItem({ entry }: { entry: SharedAnalysis }) {
  const review = splitAiReview(entry.content, entry.scope)
  return <Link className="analysis-history-item" to={`/matches/${entry.match_id}${entry.scope === 'event' ? `?fightIndex=${entry.fight_index}` : ''}#match-ai`}><div><span className="section-index">MATCH #{entry.match_id} · {entry.scope === 'event' ? `团战节点 ${entry.fight_index + 1}` : '整场分析'}</span><h3>{review.summary || (entry.scope === 'event' ? '团战节点 AI 分析' : '整场比赛 AI 胜负分析')}</h3><p>{entry.content.replace(/\s+/g, ' ').slice(0, 150)}{entry.content.length > 150 ? '…' : ''}</p></div><div className="analysis-history-meta"><span>{entry.model || 'AI 模型'}</span><time>{new Date(entry.updated_at.replace(' ', 'T') + (entry.updated_at.endsWith('Z') ? '' : 'Z')).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</time><ArrowRight size={17}/></div></Link>
}
function HomePage({ followed, add, remove, ownId, bindOwn, unbindOwn }: { followed: string[]; add: (id: string) => void; remove: (id: string) => void; ownId: string; bindOwn: (id: string) => void; unbindOwn: () => void }) {
  const [input, setInput] = useState(''); const [error, setError] = useState(''); const [showAdd, setShowAdd] = useState(false)
  const follow = (e: React.FormEvent) => { e.preventDefault(); const id = normalizeSteamId(input); if (!id) { setError('请输入有效的 Steam 账号 ID（32 位或 64 位）'); return }; if (id === ownId) { setError('这是你绑定的账号，已在“我的账号”中显示'); return }; if (followed.includes(id)) { setError('已经关注这位玩家了'); return }; add(id); setShowAdd(false); setInput(''); setError('') }
  return <><div className="welcome"><div className="eyebrow"><span className="eyebrow-line" /> YOUR MATCH INTELLIGENCE</div><h1>让每一场比赛，<br /><span>都有迹可循。</span></h1><p>追踪玩家表现、解读比赛转折，用数据和 AI 看见胜负背后的每一步。</p><div className="hero-actions"><Link className="button primary" to="/matches">开始复盘一场比赛 <ArrowRight size={17} /></Link><Link className="button outline" to="/players">查看玩家战绩 <ChevronRight size={17} /></Link></div><div className="welcome-decoration"><span className="orbit orbit-one"/><span className="orbit orbit-two"/><span className="orbit orbit-three"/><div className="decor-core"><Crosshair size={55} strokeWidth={1}/></div><span className="decor-point one"/><span className="decor-point two"/><span className="decor-point three"/></div></div>
    <section className="quick-actions"><div className="section-heading"><div><span className="section-index">01 / QUICK ACCESS</span><h2>快速开始</h2></div></div><div className="quick-grid"><div className="quick-card"><div className="quick-icon amber"><Swords size={23} /></div><div><h3>比赛复盘</h3><p>输入比赛 ID，查看关键事件与 AI 解读。</p></div><SearchBox kind="match" placeholder="输入比赛 ID" compact /></div><div className="quick-card"><div className="quick-icon green"><Users size={23} /></div><div><h3>玩家战绩</h3><p>了解英雄表现、模式胜率和历史比赛。</p></div><SearchBox kind="player" placeholder="输入 Steam 账号 ID" compact /></div></div></section>
    <MyAccount id={ownId} onBind={bindOwn} onUnbind={unbindOwn}/>
    <section className="section-spaced"><div className="section-heading"><div><span className="section-index">02 / FOLLOWING</span><h2>关注的玩家 <span className="count">{followed.length.toString().padStart(2, '0')}</span></h2><p>你关注的玩家，一眼了解最近状态。</p></div><button className="button small outline" onClick={() => setShowAdd(true)}><Plus size={17}/> 添加玩家</button></div><FollowGrid ids={followed} remove={remove} /></section>
    {showAdd && <div className="modal-backdrop" onMouseDown={() => setShowAdd(false)}><div className="modal mini-modal" onMouseDown={e => e.stopPropagation()}><button className="modal-close icon-button" onClick={() => setShowAdd(false)}><X size={20}/></button><div className="modal-icon"><Users size={22}/></div><h2>关注玩家</h2><p>输入 Steam 账号 ID，添加后会显示在你的首页。支持 32 位账号 ID 或 SteamID64。</p><form onSubmit={follow}><label>STEAM 账号 ID<input autoFocus value={input} onChange={e => {setInput(e.target.value);setError('')}} placeholder="例如 86745912" /></label>{error && <small className="form-error">{error}</small>}<button className="button primary full" type="submit">添加关注 <ArrowRight size={17}/></button></form></div></div>}
    <AnalysisHistory />
  </>
}
function PlayersIndex({ followed, remove, ownId, bindOwn, unbindOwn }: { followed: string[]; remove: (id: string) => void; ownId: string; bindOwn: (id: string) => void; unbindOwn: () => void }) { return <><div className="page-heading"><div className="eyebrow"><span className="eyebrow-line"/> PLAYER TRACKER</div><h1>关注玩家</h1><p>追踪每个玩家的战绩趋势和英雄表现。</p></div><div className="surface search-panel"><div><strong>查找玩家</strong><p>支持 32 位 Steam 账号 ID 或 SteamID64</p></div><SearchBox kind="player" /></div><MyAccount id={ownId} onBind={bindOwn} onUnbind={unbindOwn}/><div className="section-heading smaller"><div><span className="section-index">YOUR ROSTER</span><h2>我的关注 <span className="count">{followed.length.toString().padStart(2, '0')}</span></h2></div></div><FollowGrid ids={followed} remove={remove}/></> }
function MatchIndex() { return <><div className="page-heading"><div className="eyebrow"><span className="eyebrow-line"/> MATCH REVIEW</div><h1>比赛复盘</h1><p>从时间轴到每一次决策，重新理解这场比赛。</p></div><div className="entry-panel"><div className="entry-symbol"><Crosshair size={35}/></div><span className="section-index">START WITH A MATCH ID</span><h2>从一场比赛开始</h2><p>粘贴 Dota 2 比赛 ID，即可查看数据、团战和比赛事件。已解析的比赛可用于 AI 决策分析。</p><SearchBox kind="match" placeholder="例如 9018705307" /></div><div className="help-row"><div><FileText size={19}/><span>公开比赛数据</span></div><div><Activity size={19}/><span>关键节点时间轴</span></div><div><Sparkles size={19}/><span>AI 决策复盘</span></div></div></> }
function MatchRows({ matches }: { matches: RecentMatch[] }) { return <div className="match-list">{matches.map(m => <Link to={`/matches/${m.match_id}`} className="match-row" key={m.match_id}><Hero id={m.hero_id}/><div className="match-primary"><strong>{heroNames[m.hero_id]?.name || `英雄 ${m.hero_id}`}</strong><small>{modeName(m.game_mode)} · {date(m.start_time)}</small></div><span className={`result ${won(m) ? 'victory' : 'defeat'}`}>{won(m) ? '胜利' : '失败'}</span><span className="match-kda">{m.kills} / {m.deaths} / {m.assists}</span><span className="match-duration"><Clock3 size={13}/> {clock(m.duration)}</span><ChevronRight className="row-arrow" size={18}/></Link>)}</div> }
function RecentPlayerMatches({ id }: { id: string }) {
  const recent = useQuery(() => getMatches(id, { limit: 5 }), [id], playerCacheKey('matches', id, 'limit=5'))
  const games = recent.data || []
  const wins = games.filter(won).length
  return <section className="detail-section recent-matches" aria-labelledby="recent-matches-title">
    <div className="section-heading"><div><span className="section-index">LATEST MATCHES</span><h2 id="recent-matches-title">近期比赛</h2><p>最近 5 场公开比赛，点击可进入单场复盘。</p></div><a className="button small outline" href="#history">查看完整战绩 <ArrowRight size={16}/></a></div>
    <div className="surface list-surface">{recent.loading ? <Loader label="正在加载近期比赛..."/> : recent.error ? <ErrorBox message={recent.error}/> : !games.length ? <Empty title="暂无近期比赛" text="该玩家暂时没有可查看的公开比赛记录。"/> : <><div className="recent-summary"><span>最近 {games.length} 场</span><strong>{wins} 胜 / {games.length - wins} 负</strong><span>胜率 {Math.round(wins / games.length * 100)}%</span></div><MatchRows matches={games}/></>}</div>
  </section>
}
function PlayerDetail({ followed, add, remove, ownId }: { followed: string[]; add: (id: string) => void; remove: (id: string) => void; ownId: string }) {
 const { id = '' } = useParams(); const [mode, setMode] = useState(''); const [filter, setFilter] = useState(''); const [offset, setOffset] = useState(0); const [hero, setHero] = useState(''); const profile = useQuery(() => getPlayer(id), [id], playerCacheKey('profile', id)); const heroes = useQuery(() => getHeroes(id, mode), [id, mode], playerCacheKey('heroes', id, mode)); const matches = useQuery(() => getMatches(id, { limit: 20, offset, game_mode: mode, hero_id: hero, win: filter }), [id, mode, hero, filter, offset], playerCacheKey('matches', id, new URLSearchParams(Object.entries({ limit: 20, offset, game_mode: mode, hero_id: hero, win: filter }).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)])).toString())); const trumpets = useQuery(() => getMatches(id, { limit: 10 }), [id], playerCacheKey('matches', id, 'limit=10')); const p = profile.data?.profile; const topHeroes = [...(heroes.data || [])].filter(h => h.games > 0).sort((a,b) => b.games - a.games); const total = topHeroes.reduce((n, h) => n + h.games, 0); const wins = topHeroes.reduce((n,h) => n + h.win, 0)
 useEffect(() => setOffset(0), [id, mode, hero, filter])
 return <><Link to="/players" className="back-link"><ArrowLeft size={16}/> 返回玩家列表</Link><div className="profile-hero"><div className="profile-identity"><div className="profile-avatar">{p?.avatarfull ? <img src={p.avatarfull} alt=""/> : <Users size={32}/>}</div><div><div className="eyebrow"><span className="eyebrow-line"/> PLAYER PROFILE</div><div className="profile-name-line"><h1>{p?.personaname || `玩家 ${id}`}</h1><TrumpetBadge matches={trumpets.data}/></div><span className="profile-sub">STEAM ACCOUNT ID · {id}</span></div></div>{id === ownId ? <span className="own-profile-badge"><UserRound size={16}/> 我的账号</span> : <button className={`button ${followed.includes(id) ? 'outline' : 'primary'}`} onClick={() => followed.includes(id) ? remove(id) : add(id)}>{followed.includes(id) ? <><Check size={17}/> 已关注</> : <><Plus size={17}/> 关注玩家</>}</button>}</div>
 {profile.loading ? <Loader/> : profile.error ? <ErrorBox message={profile.error}/> : <><div className="stat-grid"><div className="stat-card"><small>公开比赛总场次</small><strong>{(profile.data?.win || 0) + (profile.data?.lose || 0)}</strong><span>所有模式</span></div><div className="stat-card"><small>整体胜率</small><strong className="green-text">{(profile.data?.win || 0) + (profile.data?.lose || 0) ? Math.round((profile.data?.win || 0) / ((profile.data?.win || 0) + (profile.data?.lose || 0)) * 100) : 0}%</strong><span>{profile.data?.win || 0} 胜 / {profile.data?.lose || 0} 负</span></div><div className="stat-card"><small>当前模式英雄场次</small><strong>{total}</strong><span>{mode ? modeName(Number(mode)) : '所有模式'}</span></div><div className="stat-card"><small>当前模式英雄胜率</small><strong>{total ? Math.round(wins / total * 100) : 0}%</strong><span>按英雄统计</span></div></div></>}
 <RecentStats id={id} ownId={ownId}/>
 <RecentPlayerMatches id={id}/>
 <RecentTeammates id={id}/>
 <div id="history" className="detail-section"><div className="section-heading"><div><span className="section-index">MATCH HISTORY</span><h2>历史战绩</h2><p>{hero ? `筛选：${heroNames[Number(hero)]?.name || hero} · 点击下方英雄可取消` : '按模式、英雄和胜负筛选公开比赛'}</p></div><div className="select-wrap"><select aria-label="胜负筛选" value={filter} onChange={e => setFilter(e.target.value)}><option value="">全部结果</option><option value="1">仅胜利</option><option value="0">仅失败</option></select><ChevronDown size={14}/></div></div><div className="surface list-surface">{matches.loading ? <Loader/> : matches.error ? <ErrorBox message={matches.error}/> : !matches.data?.length ? <Empty title="没有符合条件的比赛" text="试试切换模式或清除英雄筛选。"/> : <><MatchRows matches={matches.data}/><div className="pagination"><button className="button subtle" disabled={!offset} onClick={() => setOffset(Math.max(0,offset - 20))}>上一页</button><span>第 {offset / 20 + 1} 页</span><button className="button subtle" disabled={matches.data.length < 20} onClick={() => setOffset(offset + 20)}>下一页</button></div></>}</div></div>
 <div className="detail-section"><div className="section-heading"><div><span className="section-index">HERO PERFORMANCE</span><h2>英雄表现</h2><p>按游戏模式查看每个英雄的胜率与场次。</p></div><div className="select-wrap"><Filter size={15}/><select aria-label="英雄统计模式" value={mode} onChange={e => setMode(e.target.value)}><option value="">所有模式</option>{[[22,'天梯匹配'],[1,'全英雄选择'],[23,'加速模式'],[2,'队长模式'],[3,'随机征召'],[4,'单一征召'],[5,'随机模式']].map(([v,n]) => <option key={v} value={v}>{n}</option>)}</select><ChevronDown size={14}/></div></div><div className="surface">{heroes.loading ? <Loader/> : heroes.error ? <ErrorBox message={heroes.error}/> : !topHeroes.length ? <Empty title="暂无英雄记录" text="这个模式下没有公开比赛记录。"/> : <div className="hero-stat-list"><div className="hero-stat-header"><span>英雄</span><span>比赛场次</span><span>胜率</span><span>表现</span></div>{topHeroes.map(h => <button className={`hero-stat-row ${hero === String(h.hero_id) ? 'selected' : ''}`} key={h.hero_id} onClick={() => { setHero(hero === String(h.hero_id) ? '' : String(h.hero_id)); document.getElementById('history')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}><span className="hero-cell"><Hero id={h.hero_id}/><strong>{heroNames[h.hero_id]?.name || `英雄 ${h.hero_id}`}</strong></span><span>{h.games} <small>场</small></span><span className={h.games > 2 && h.win / h.games >= .5 ? 'green-text' : ''}>{Math.round(h.win / h.games * 100)}%</span><span className="win-bar"><i style={{width: `${h.win / h.games * 100}%`}}/></span></button>)}</div>}</div></div></>

}
function Advantage({ match }: { match: Match }) { const values = match.radiant_gold_adv || []; const chart = values.map((gold, minute) => ({ minute, gold })); if (!values.length) return <div className="chart-empty">这场比赛暂时没有已解析的经济曲线</div>; return <div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 15, left: 0, right: 15, bottom: 0 }}><defs><linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d6a968" stopOpacity={0.35}/><stop offset="100%" stopColor="#d6a968" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#e9ebeb" strokeDasharray="4 4"/><XAxis dataKey="minute" tick={{fontSize: 11, fill: '#9ba4a7'}} tickLine={false} axisLine={false} unit="′"/><YAxis tickFormatter={short} tick={{fontSize: 11, fill: '#9ba4a7'}} tickLine={false} axisLine={false} width={36}/><Tooltip contentStyle={{borderRadius: 10, border: '1px solid #e8ebeb', fontSize: 12}} formatter={(value) => [`${Number(value) > 0 ? '+' : ''}${value} 金币`, '天辉领先']} labelFormatter={label => `${label} 分钟`}/><ReferenceLine y={0} stroke="#aab4b4"/><Area type="monotone" dataKey="gold" stroke="#c49350" strokeWidth={2.5} fill="url(#goldFill)" dot={false}/></AreaChart></ResponsiveContainer></div> }
function AIPanel({ match, selected, settings, onSettings }: { match: Match; selected?: Event; settings: Settings; onSettings: () => void }) {
  const [result, setResult] = useState(''); const [error, setError] = useState(''); const [running, setRunning] = useState(false); const [job, setJob] = useState<AnalysisJob | null>(null); const [scope, setScope] = useState<'whole' | 'event'>(() => /^\d+$/.test(new URLSearchParams(location.search).get('fightIndex') || '') ? 'event' : 'whole')
  useEffect(() => {
    let active = true
    setResult(''); setError(''); setJob(null); setScope(/^\d+$/.test(new URLSearchParams(location.search).get('fightIndex') || '') ? 'event' : 'whole')
    if (!/^\d+$/.test(new URLSearchParams(location.search).get('fightIndex') || '')) {
      getSharedAnalysis(match.match_id, 'whole').then(({ analysis }) => { if (active && analysis) setResult(analysis.content) }).catch(() => {})
    }
    return () => { active = false }
  }, [match.match_id])
  useEffect(() => {
    if (scope !== 'event' || !selected || selected.type !== 'fight') return
    const index = Number(selected.id.replace('fight-', ''))
    let active = true
    getSharedAnalysis(match.match_id, 'event', index).then(({ analysis }) => { if (active && analysis) setResult(analysis.content) }).catch(() => {})
    return () => { active = false }
  }, [match.match_id, scope, selected?.id])
  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const jobs = await getAnalysisJobs(match.match_id)
        if (!active) return
        const selectedIndex = selected?.type === 'fight' ? Number(selected.id.replace('fight-', '')) : -1
        const current = jobs.find(item => item.scope === scope && item.fight_index === (scope === 'event' ? selectedIndex : -1)) || null
        setJob(current)
        if (current?.status === 'completed') {
          const { analysis } = await getSharedAnalysis(match.match_id, scope, scope === 'event' ? selectedIndex : undefined)
          if (active && analysis) setResult(analysis.content)
        }
      } catch { /* Existing result remains available while job status is temporarily unavailable. */ }
    }
    void refresh()
    const timer = setInterval(refresh, 4000)
    return () => { active = false; clearInterval(timer) }
  }, [match.match_id, scope, selected?.id])
  const analyze = async (requestedScope: 'whole' | 'event') => {
    setScope(requestedScope); setError(''); setResult('')
    if (!settings.apiKey || !settings.model || !settings.baseUrl) { setError('先填写 API Key、Base URL 和模型名称。'); onSettings(); return }
    setRunning(true)
    const fightIndex = requestedScope === 'event' && selected?.type === 'fight' ? Number(selected.id.replace('fight-', '')) : undefined
    const evidence = buildAnalysisEvidence(match, Number.isInteger(fightIndex) ? fightIndex : undefined)
    const prompt = requestedScope === 'event' && selected
      ? `聚焦 ${clock(selected.time)} 的「${selected.title}」：${selected.detail}。先说明事前可观察到的局势，再列出实际事件与随后 3 分钟的经济/目标变化。根据可用数据讨论可能的选择和替代方案；若无法知道视野、位置或发起决策的人，不得指定个人责任。`
      : '请像和队友复盘一样，先说这局怎么赢或怎么输，再挑最关键的两三件事讲清楚，指出值得回看的时刻。'
    try {
      const jobId = await startAnalysisJob({ evidence, settings, scope: requestedScope, prompt, matchId: match.match_id, fightIndex })
      setJob({ id: jobId, match_id: String(match.match_id), scope: requestedScope, fight_index: requestedScope === 'event' ? fightIndex! : -1, model: settings.model, status: 'queued', step: 0, total: 0, error: '', created_at: new Date().toISOString() })
    } catch (e) { setError(e instanceof Error ? e.message : '分析失败') } finally { setRunning(false) }
  }
  const review = splitAiReview(result, scope)
  return <div className="ai-panel"><div className="ai-head"><span className="ai-icon"><Sparkles size={21}/></span><div><span className="section-index">INTELLIGENT REVIEW</span><h3>AI 胜负分析</h3></div><span className="ai-badge">BETA</span></div><p className="ai-description">先判断对局走势，再从选手、阵容、对线和团战解释胜负关键，并给出可核对的改进方向。</p><div className="ai-actions"><button className="button primary" disabled={running || (scope === 'whole' && (job?.status === 'queued' || job?.status === 'running'))} onClick={() => analyze('whole')}>{running && scope === 'whole' ? <LoaderCircle className="spin" size={17}/> : <Sparkles size={17}/>} {running && scope === 'whole' ? '分析中...' : '分析整场胜负'}</button><button className="button outline" disabled={running || !selected || selected.type === 'system' || (scope === 'event' && (job?.status === 'queued' || job?.status === 'running'))} onClick={() => analyze('event')}>{running && scope === 'event' ? <LoaderCircle className="spin" size={17}/> : <Target size={17}/>} 分析选中节点</button></div>{selected && selected.type !== 'system' && <p className="selected-hint">当前节点：{clock(selected.time)} · {selected.title}</p>}{job && (job.status === 'queued' || job.status === 'running') && <p role="status" className="selected-hint">后台分析中 {job.total ? `${job.step}/${job.total}` : '已排队'}；关闭页面后仍会继续，完成后可在首页历史记录查看。</p>}{job?.status === 'failed' && <p className="ai-error">{job.error || '后台分析失败，请稍后重试。'}</p>}{error && <p className="ai-error">{error}</p>}{result && <div className="ai-result"><div className="result-heading"><Sparkles size={16}/> {scope === 'whole' ? '整场比赛分析' : '节点决策分析'} <span>由 {settings.model} 生成</span></div><div className="result-text"><section className="ai-summary"><strong>{scope === 'whole' ? '对局情况' : '节点结论'}</strong><p>{review.summary || '模型未单独给出结论，请查看下方分析并结合比赛回放核实。'}</p></section>{review.details && <div className="ai-review-details">{review.details}</div>}</div></div>}<div className="ai-note"><Shield size={15}/> 按时间结合经济、团战与各玩家购买记录分析；缺少装备库存、回放与沟通时不推断实际使用或强行归责。API Key 加密后传给后台任务；已完成的工作流状态最多保留 3 天。</div></div>
}
function ParseRequest({ matchId }: { matchId: string }) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted'>('idle')
  const [error, setError] = useState('')
  const submit = async () => {
    if (status !== 'idle') return
    setStatus('submitting'); setError('')
    try { await requestMatchParse(matchId); setStatus('submitted') }
    catch (cause) { setStatus('idle'); setError(cause instanceof Error ? cause.message : '提交解析请求失败') }
  }
  return <div className="parse-request"><button type="button" className="button primary" disabled={status !== 'idle'} onClick={submit}>{status === 'submitting' ? <LoaderCircle className="spin" size={15}/> : <FileText size={15}/>} {status === 'submitting' ? '正在提交…' : status === 'submitted' ? '已提交解析请求' : '一键提交给 OpenDota 解析'}</button>{status === 'submitted' && <button type="button" className="button outline" onClick={() => location.reload()}>刷新比赛数据</button>}{error && <span role="alert" className="parse-request-error">{error}</span>}<small>{status === 'submitted' ? 'OpenDota 已受理；解析需要时间，稍后刷新查看。' : '解析由 OpenDota 处理，提交不保证立即获得日志。'}</small></div>
}
function MatchDetail({ settings, onSettings }: { settings: Settings; onSettings: () => void }) {
 const { id = '' } = useParams(); const route = useLocation(); const matchQuery = useQuery(() => getMatch(id), [id]); const [trumpets, setTrumpets] = useState<Record<string, { trumpet_count: number; rules?: string[] }>>({}); const [selectedId, setSelectedId] = useState<string | undefined>(() => { const index = new URLSearchParams(route.search).get('fightIndex'); return index && /^\d+$/.test(index) ? `fight-${index}` : undefined }); const [eventFilter, setEventFilter] = useState('all'); const [itemPlayer, setItemPlayer] = useState('all'); const [visibleEvents, setVisibleEvents] = useState(80); const match = matchQuery.data; const allEvents = useMemo(() => match ? timeline(match) : [], [match]); const events = allEvents.filter(e => (eventFilter === 'all' || e.type === eventFilter) && (e.type !== 'item' || itemPlayer === 'all' || String(e.playerSlot) === itemPlayer)); const selected = allEvents.find(e => e.id === selectedId) || allEvents.find(e => e.type === 'fight' || e.type === 'objective') || allEvents[0]; const parsed = Boolean(match?.version && allEvents.some(e => e.type !== 'system'))
 useEffect(() => {
   let active = true
   setTrumpets({})
   const ids = (match?.players || []).flatMap(player => { const accountId = player.account_id; return typeof accountId === 'number' && Number.isSafeInteger(accountId) && accountId > 0 && accountId <= 4294967295 ? [String(accountId)] : [] })
   if (!ids.length) return () => { active = false }
   requestTrumpets(ids).then(results => { if (active) setTrumpets(Object.fromEntries(results.map(result => [result.account_id, { trumpet_count: result.trumpet_count, rules: (() => { try { return JSON.parse(result.rules) as string[] } catch { return [] } })() }])))}).catch(() => {})
   return () => { active = false }
 }, [match?.match_id])
 useEffect(() => { const index = new URLSearchParams(route.search).get('fightIndex'); setSelectedId(index && /^\d+$/.test(index) ? `fight-${index}` : undefined); setEventFilter('all'); setItemPlayer('all'); setVisibleEvents(80) }, [id, route.search])
 return <div className="match-page"><Link to="/matches" className="back-link"><ArrowLeft size={16}/> 返回比赛复盘</Link>{matchQuery.loading ? <Loader/> : matchQuery.error ? <><ErrorBox message={matchQuery.error}/>{/^\d{1,20}$/.test(id) && ['OpenDota 尚未收录这场比赛', '找不到对应数据'].includes(matchQuery.error) && <div className="missing-match-request"><p>如果比赛 ID 正确，可提交给 OpenDota 请求解析；比赛数据仍需等待 OpenDota 收录。</p><ParseRequest key={id} matchId={id}/></div>}</> : match && <div className="match-detail"><div className="match-hero"><div className="eyebrow"><span className="eyebrow-line"/> 比赛概览 <span className="match-code"># {match.match_id}</span></div><div className="match-verdict">{match.radiant_win ? '天辉胜利' : '夜魇胜利'}</div><div className="match-score"><div className="team-score radiant"><span>RADIANT · 天辉</span><strong>{match.radiant_score}</strong><small>{match.radiant_win ? '获胜方' : '败方'}</small></div><div className="score-center"><span>{clock(match.duration)}</span><small>{modeName(match.game_mode)}</small></div><div className="team-score dire"><span>DIRE · 夜魇</span><strong>{match.dire_score}</strong><small>{!match.radiant_win ? '获胜方' : '败方'}</small></div></div><div className="match-meta"><span><Swords size={15}/> 比赛 #{match.match_id}</span><span><Clock3 size={15}/> {clock(match.duration)}</span><span><Activity size={15}/> {date(match.start_time)}</span><span className={parsed ? 'parse-good' : 'parse-pending'}><span className="status-dot"/> {parsed ? '已解析事件' : '缺少解析日志'}</span></div><nav className="match-tabs" aria-label="比赛详情导航"><a href="#match-scoreboard">概览</a>{match.radiant_gold_adv?.length ? <a href="#match-trends">经济</a> : null}<a href="#match-insights">复盘线索</a>{match.teamfights?.length ? <a href="#match-fights">团战</a> : null}<a href="#chronicle">时间轴</a><a href="#match-ai">AI 分析</a></nav></div>
 {!parsed && <div className="notice"><FileText size={19}/><div><strong>当前比赛缺少完整解析日志</strong><p>OpenDota 暂未提供这场比赛的团战、目标与经济时序数据。可查看十人战绩；AI 会明确标注无法验证的判断。</p><ParseRequest key={id} matchId={id}/></div></div>}

 <MatchScoreboard match={match} trumpets={trumpets}/>{Boolean(match.radiant_gold_adv?.length) && <div id="match-trends" className="match-summary-grid"><div className="surface summary-card"><div className="card-title"><div><span className="section-index">GOLD ADVANTAGE</span><h3>经济走势</h3></div><span className="chart-legend"><i/> 天辉经济优势</span></div><Advantage match={match}/><div className="chart-footer"><span><i className="radiant-marker"/> 天辉领先</span><span><i className="dire-marker"/> 夜魇领先</span></div></div></div>}
 <section id="match-ai" className="match-ai-section"><AIPanel key={`${match.match_id}:${route.search}`} match={match} selected={selected} settings={settings} onSettings={onSettings}/></section><FightBreakdown match={match} selectedIndex={selectedId?.startsWith('fight-') ? Number(selectedId.slice(6)) : undefined} onSelect={index => setSelectedId(`fight-${index}`)}/>
 <div id="match-insights"><ReviewOverview match={match} onFight={index => { setSelectedId(`fight-${index}`); document.getElementById('match-fights')?.scrollIntoView({ behavior: 'smooth' }) }}/></div><div className="review-layout"><section id="chronicle" className="timeline-section"><div className="section-heading"><div><span className="section-index">MATCH CHRONICLE</span><h2>比赛时间轴 <span className="count">{allEvents.filter(e => e.type !== 'system').length.toString().padStart(2, '0')}</span></h2><p>按时间查看团战、击杀、目标及十名玩家的购买记录。选择事件可聚焦分析。</p></div></div><div className="filter-tabs">{[['all','全部事件'],['fight','团战'],['objective','地图目标'],['kill','击杀日志'],['item','出装购买']].map(([value,label]) => <button key={value} className={eventFilter === value ? 'active' : ''} onClick={() => { setEventFilter(value); setVisibleEvents(80) }}>{label}</button>)}</div>{(eventFilter === 'all' || eventFilter === 'item') && <div className="item-timeline-filter"><label htmlFor="item-player-filter">购买玩家</label><select id="item-player-filter" value={itemPlayer} onChange={e => { setItemPlayer(e.target.value); setVisibleEvents(80) }}><option value="all">全部玩家</option>{match.players.map(p => <option key={p.player_slot} value={p.player_slot}>{p.player_slot < 128 ? '天辉' : '夜魇'} · {heroNames[p.hero_id]?.name || `英雄 ${p.hero_id}`} · {playerName(p)}</option>)}</select><small>购买时间不等于装备完成或实际持有时间</small></div>}<div className="timeline">{events.length ? events.slice(0, visibleEvents).map(e => <button key={e.id} onClick={() => setSelectedId(e.id)} className={`timeline-item ${e.id === selected?.id ? 'active' : ''}`}><div className="timeline-time">{clock(e.time)}</div><div className={`timeline-marker ${e.type}`}><span>{e.type === 'item' ? '◆' : e.type === 'objective' ? '◆' : ''}</span></div><div className={`timeline-content timeline-content-${e.type}`}><div className="event-meta"><span className="event-category">{e.type === 'fight' ? '团战' : e.type === 'objective' ? '地图目标' : e.type === 'kill' ? '英雄击杀' : e.type === 'item' ? '出装购买' : '比赛事件'}</span>{e.side && <span className={`event-side ${e.side}`}>{e.side === 'radiant' ? '天辉' : '夜魇'}</span>}</div><h3 className={e.type === 'item' ? 'item-event-heading' : undefined}>{e.type === 'item' && e.itemKey && <img className="item-event-image" src={itemImage(e.itemKey)} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none' }}/>}<span>{e.title}</span></h3><p>{e.detail}</p></div><ChevronRight className="event-arrow" size={17}/></button>) : <Empty title="暂无该类事件" text="试试切换至全部事件。"/>}{events.length > visibleEvents && <button className="button subtle timeline-more" onClick={() => setVisibleEvents(n => n + 80)}>显示更多 · 已显示 {visibleEvents} / {events.length} 条 <ArrowDownRight size={15}/></button>}</div><div className="timeline-disclaimer">事件与出装取自 OpenDota 已解析数据。购买日志记录购买动作，无法单独证明装备已合成、持有或在团战中使用。</div></section><aside className="review-aside"><div className="aside-tip"><strong><FileText size={16}/> 如何看待“谁的问题最大”？</strong><p>优先核对关键团战中的阵亡、经济变化和目标交换。没有位置信息、视野和队伍沟通时，归因只能作为复盘线索。</p></div></aside></div>
 </div>}</div>
}
function SettingsModal({ settings, save, close }: { settings: Settings; save: (value: Settings) => void; close: () => void }) {
  const [draft, setDraft] = useState(settings)
  const [showKey, setShowKey] = useState(false)
  const [testState, setTestState] = useState<{ kind: 'idle' | 'running' | 'success' | 'error'; message: string }>({ kind: 'idle', message: '' })
  const testVersion = useRef(0)
  const edit = (field: keyof Settings, value: string | boolean) => {
    testVersion.current++
    setDraft(current => ({ ...current, [field]: value }))
    setTestState({ kind: 'idle', message: '' })
  }
  const testConnection = async () => {
    const version = ++testVersion.current
    setTestState({ kind: 'running', message: '正在连接模型服务…' })
    try {
      await testAiConnection(draft)
      if (version === testVersion.current) setTestState({ kind: 'success', message: '连接成功，模型已返回文本。' })
    } catch (error) {
      if (version === testVersion.current) setTestState({ kind: 'error', message: error instanceof Error ? error.message : '测试连接失败，请稍后重试。' })
    }
  }
  const submit = (e: React.FormEvent) => { e.preventDefault(); save(draft); close() }
  return <div className="modal-backdrop" onMouseDown={close}><div className="modal settings-modal" onMouseDown={e => e.stopPropagation()}>
    <button className="modal-close icon-button" onClick={close} aria-label="关闭设置"><X size={20}/></button>
    <div className="modal-icon"><Settings2 size={22}/></div><h2>AI 模型设置</h2><p>接入支持 OpenAI Chat Completions 协议的模型服务。</p>
    <form onSubmit={submit}>
      <label>服务商<select value="compatible" onChange={() => {}}><option value="compatible">OpenAI（兼容协议）</option></select></label>
      <label>API Key<div className="key-input"><input type={showKey ? 'text' : 'password'} value={draft.apiKey} onChange={e => edit('apiKey', e.target.value)} placeholder="输入 API Key" autoComplete="off"/><button type="button" onClick={() => setShowKey(!showKey)}>{showKey ? '隐藏' : '显示'}</button></div><small>API Key 默认仅存于当前页面内存。</small></label>
      <label className="remember-key"><input type="checkbox" checked={draft.rememberApiKey} onChange={e => edit('rememberApiKey', e.target.checked)} /> 记住 API Key <small>勾选后会保存到本机浏览器的 localStorage；仅建议在自己的设备上使用。</small></label>
      <label>Base URL<input type="url" required value={draft.baseUrl} onChange={e => edit('baseUrl', e.target.value)} placeholder="https://api.openai.com/v1"/><small>填写到 /v1，系统会追加 /chat/completions；须使用公开 HTTPS 地址。</small></label>
      <label>模型<input required value={draft.model} onChange={e => edit('model', e.target.value)} placeholder="填写你的模型 ID"/><small>例如服务商控制台显示的模型名称。</small></label>
      <label>输出语言<select value={draft.language} onChange={e => edit('language', e.target.value)}><option>简体中文</option><option>English</option></select></label>
      <button className="button subtle full" type="button" onClick={testConnection} disabled={testState.kind === 'running'}>{testState.kind === 'running' ? <LoaderCircle className="spin" size={17}/> : <Activity size={17}/>} {testState.kind === 'running' ? '测试中…' : '测试连接'}</button>
      {testState.kind !== 'idle' && <div role="status" aria-live="polite" className={`connection-result ${testState.kind}`}>{testState.message}</div>}
      <small className="connection-note">使用当前填写的配置发送简短测试请求，可能产生少量模型费用；测试不会保存设置。</small>
      <button className="button primary full" type="submit">保存设置 <Check size={17}/></button>
    </form>
  </div></div>
}
function App() {
  const [followed, setFollowed] = useState<string[]>(() => saved<string[]>('insight-followed', []))
  const [ownId, setOwnId] = useState<string>(() => {
    const value = saved<unknown>('insight-own-account', '')
    return typeof value === 'string' ? normalizeSteamId(value) || '' : ''
  })
  const [settings, setSettings] = useState<Settings>(() => savedSettings())
  const saveSettings = (value: Settings) => {
    setSettings(value)
    localStorage.setItem(settingsStorageKey, JSON.stringify({ baseUrl: value.baseUrl, model: value.model, language: value.language, rememberApiKey: value.rememberApiKey, ...(value.rememberApiKey ? { apiKey: value.apiKey } : {}) }))
  }
  const [settingsOpen, setSettingsOpen] = useState(false)
  const add = (id: string) => { if (id !== ownId) setFollowed(current => current.includes(id) ? current : [...current, id]) }
  const remove = (id: string) => setFollowed(current => current.filter(value => value !== id))
  const bindOwn = (id: string) => { setFollowed(current => current.filter(value => value !== id)); setOwnId(id) }
  const unbindOwn = () => setOwnId('')
  useEffect(() => { if (ownId) setFollowed(current => current.includes(ownId) ? current.filter(value => value !== ownId) : current) }, [ownId])
  useEffect(() => { localStorage.setItem('insight-followed', JSON.stringify(followed)) }, [followed])
  useEffect(() => { localStorage.setItem('insight-own-account', JSON.stringify(ownId)) }, [ownId])
  return <BrowserRouter><Layout onSettings={() => setSettingsOpen(true)}><Routes>
    <Route path="/" element={<HomePage followed={followed} add={add} remove={remove} ownId={ownId} bindOwn={bindOwn} unbindOwn={unbindOwn}/>} />
    <Route path="/players" element={<PlayersIndex followed={followed} remove={remove} ownId={ownId} bindOwn={bindOwn} unbindOwn={unbindOwn}/>} />
    <Route path="/players/:id" element={<PlayerDetail followed={followed} add={add} remove={remove} ownId={ownId}/>} />
    <Route path="/matches" element={<MatchIndex/>} />
    <Route path="/matches/:id" element={<MatchDetail settings={settings} onSettings={() => setSettingsOpen(true)}/>} />
    <Route path="*" element={<Empty title="页面不存在" text="请从侧边栏选择要查看的内容。"/>}/>
  </Routes></Layout>{settingsOpen && <SettingsModal settings={settings} save={saveSettings} close={() => setSettingsOpen(false)}/>}</BrowserRouter>
}

createRoot(document.getElementById('root')!).render(<App/>)
