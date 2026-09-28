import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, UserRound, X } from 'lucide-react'
import { getPlayer, normalizeSteamId } from './data'

export function MyAccount({ id, onBind, onUnbind }: { id: string; onBind: (id: string) => void; onUnbind: () => void }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const bind = async (event: FormEvent) => {
    event.preventDefault()
    const account = normalizeSteamId(input)
    if (!account) { setError('请输入有效的 Steam 账号 ID（32 位或 64 位）'); return }
    setError('')
    setBusy(true)
    try {
      await getPlayer(account)
      onBind(account)
      setInput('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '账号验证失败，请稍后重试')
    } finally { setBusy(false) }
  }
  return <section className="my-account surface" aria-label="我的账号">
    <div className="my-account-heading"><UserRound size={20}/><div><strong>我的账号</strong><p>单独绑定，用于与其他玩家的近期表现对比；仅保存在当前浏览器。</p></div></div>
    {id ? <div className="my-account-bound"><Link to={`/players/${id}`}>我的个人主页 · {id} <ArrowRight size={15}/></Link><button type="button" className="button small outline" onClick={onUnbind}>解除绑定 <X size={14}/></button></div> : <form onSubmit={bind} className="my-account-form"><label htmlFor="my-steam-id">Steam 账号 ID</label><input id="my-steam-id" value={input} onChange={event => { setInput(event.target.value); setError('') }} placeholder="32 位账号 ID 或 SteamID64" inputMode="numeric"/><button type="submit" className="button small primary" disabled={busy}>{busy ? '验证中...' : '绑定我的账号'}</button>{error && <small className="form-error" role="alert">{error}</small>}</form>}
  </section>
}
