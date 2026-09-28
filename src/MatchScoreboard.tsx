import { heroImage, itemKeyById, heroNames, type Match, type MatchPlayer } from './data'
import { itemImage, itemName } from './locale'
import { MatchPlayerName } from './MatchPlayerName'

const slots = ['item_0', 'item_1', 'item_2', 'item_3', 'item_4', 'item_5'] as const

export function MatchScoreboard({ match }: { match: Match }) {
  return <section id="match-scoreboard" className="match-scoreboard" aria-label="双方战绩">
    {([['radiant', '天辉'], ['dire', '夜魇']] as const).map(([side, title]) => {
      const players = match.players.filter(player => (player.player_slot < 128) === (side === 'radiant'))
      const kills = side === 'radiant' ? match.radiant_score : match.dire_score
      return <div key={side} className={`scoreboard-team ${side}`}>
        <div className="scoreboard-team-heading"><span className="scoreboard-emblem">{side === 'radiant' ? '◈' : '◆'}</span><div><small>{side.toUpperCase()}</small><h2>{title} · 战绩</h2></div>{match.radiant_win === (side === 'radiant') && <span className="scoreboard-winner">胜方</span>}<strong>{kills} 击杀</strong></div>
        <div className="scoreboard-scroll"><table className="scoreboard-table"><thead><tr><th>玩家 / 英雄</th><th>等级</th><th>击杀</th><th>死亡</th><th>助攻</th><th>正 / 反补</th><th>净资产</th><th>GPM / XPM</th><th>英雄伤害</th><th>建筑伤害</th><th>出装</th></tr></thead><tbody>{players.map(player => <PlayerRow key={player.player_slot} player={player}/>)}</tbody></table></div>
      </div>
    })}
    <p className="scoreboard-footnote">装备栏显示比赛结束时的快照；详细购买时间请查看下方比赛时间轴。空白数据表示 OpenDota 未提供。</p>
  </section>
}

function PlayerRow({ player }: { player: MatchPlayer }) {
  return <tr>
    <td><div className="scoreboard-player"><img className="scoreboard-hero-image" src={heroImage(player.hero_id)} alt={heroNames[player.hero_id]?.name || `英雄 ${player.hero_id}`} loading="lazy"/><span><MatchPlayerName player={player}/><small>{heroNames[player.hero_id]?.name || `英雄 ${player.hero_id}`}</small></span></div></td>
    <td>{player.level ?? '—'}</td><td className="scoreboard-kill">{player.kills}</td><td className="scoreboard-death">{player.deaths}</td><td>{player.assists}</td><td>{player.last_hits ?? '—'} / {player.denies ?? '—'}</td><td className="scoreboard-worth">{player.net_worth?.toLocaleString('zh-CN') ?? '—'}</td><td>{player.gold_per_min} / {player.xp_per_min}</td><td>{player.hero_damage?.toLocaleString('zh-CN') ?? '—'}</td><td>{player.tower_damage?.toLocaleString('zh-CN') ?? '—'}</td>
    <td><div className="scoreboard-items">{slots.map(slot => { const id = player[slot]; const key = id ? itemKeyById[String(id)] : undefined; return <span className="scoreboard-item" key={slot} title={key ? itemName(key) : id ? `未收录物品（ID ${id}）` : '空装备栏'}>{key && <img src={itemImage(key)} alt={itemName(key)} loading="lazy" onError={event => { event.currentTarget.style.display = 'none' }}/>}</span> })}</div></td>
  </tr>
}
