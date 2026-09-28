import { Link } from 'react-router-dom'
import { playerName, type MatchPlayer } from './data'

export function MatchPlayerName({ player }: { player: MatchPlayer }) {
  const id = player.account_id
  if (!Number.isSafeInteger(id) || !id || id < 1 || id > 4294967295) {
    const name = player.personaname || '匿名玩家'
    return <strong title={name}>{name}</strong>
  }
  const name = playerName(player)
  return <Link className="match-player-link" to={`/players/${id}`} title={`查看 ${name} 的个人主页`}><strong>{name}</strong></Link>
}
