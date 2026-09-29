import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { WechatyBuilder } from 'wechaty'
import qr from 'qrcode-terminal'
import './integration-page-compat.mjs'
import { validateConfig, selectRoom, newMatches, matchText } from './logic.mjs'

const loginProbe = process.env.WECHAT_LOGIN_PROBE === '1'
const config = validateConfig(loginProbe ? { ...process.env, DOTA_ACCOUNT_ID: '1' } : process.env)
const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!process.env.WECHATY_PUPPET_WECHAT_ENDPOINT && existsSync(macChrome)) process.env.WECHATY_PUPPET_WECHAT_ENDPOINT = macChrome
const stateDir = join(import.meta.dirname, '.state')
const statePath = join(stateDir, 'push.json')
const bot = WechatyBuilder.build({ name: 'dota2analysis-wechaty', puppet: 'wechaty-puppet-wechat' })
let busy = false
let halted = false
let timer
async function save(state) {
  await mkdir(stateDir, { recursive: true, mode: 0o700 })
  const temporary = `${statePath}.tmp`
  await writeFile(temporary, JSON.stringify(state), { mode: 0o600 })
  await rename(temporary, statePath)
}
async function load() {
  try { return JSON.parse(await readFile(statePath, 'utf8')) }
  catch (error) { if (error.code === 'ENOENT') return null; throw error }
}
async function fetchMatches() {
  const url = new URL(`https://api.opendota.com/api/players/${config.id}/matches`)
  url.searchParams.set('limit', '20')
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!response.ok) throw Error(`OpenDota HTTP ${response.status}`)
  const matches = await response.json()
  if (!Array.isArray(matches)) throw Error('OpenDota 返回了无效比赛列表')
  return matches
}
async function resolveRoom() {
  const rooms = await bot.Room.findAll({ topic: config.room })
  const candidates = await Promise.all(rooms.map(async room => ({ topic: await room.topic(), room })))
  const result = selectRoom(candidates, config.room)
  console.log(`已确认目标群：${config.room}；匹配数量：1`)
  return result
}
async function poll() {
  if (busy || halted) return
  busy = true
  try {
    const state = await load()
    if (state && (state.accountId !== config.id || state.roomName !== config.room || state.pending)) {
      throw Error('状态与当前配置不一致，或存在无法确认送达的消息；已停止发送，请人工检查 .state/push.json')
    }
    const matches = await fetchMatches()
    if (!matches.length) { console.log('暂无公开战绩'); return }
    if (!state) {
      await save({ accountId: config.id, roomName: config.room, lastMatchId: String(matches[0].match_id), pending: null })
      console.log(`已从比赛 ${matches[0].match_id} 建立基线；旧比赛不会推送`)
      return
    }
    const fresh = newMatches(matches, state.lastMatchId)
    if (!fresh.length) return
    const room = await resolveRoom()
    for (const match of fresh) {
      const id = String(match.match_id)
      if (!/^\d{1,20}$/.test(id)) throw Error('比赛 ID 无效')
      state.pending = id
      await save(state)
      await room.say(matchText(match, config.id, config.origin))
      state.lastMatchId = id
      state.pending = null
      await save(state)
      console.log(`发送接口已返回：${id}；请在微信中核对实际送达`)
    }
  } catch (error) {
    console.error('推送暂停：', error)
    halted = true
    clearInterval(timer)
  } finally { busy = false }
}
bot.on('scan', (code, status) => { console.log(`微信扫码状态：${status}`); if (code) qr.generate(code, { small: true }) })
bot.on('login', async user => { console.log(`已登录：${user.name()}`); try { await resolveRoom(); if (loginProbe) { console.log('登录和群识别通过；探测模式不会发送消息'); return } await poll(); if (!halted) timer = setInterval(poll, config.interval) } catch (error) { console.error('找不到唯一目标群，未启动推送：', error) } })
bot.on('logout', user => { console.log(`已退出：${user.name()}`); clearInterval(timer) })
bot.on('error', error => console.error('Wechaty 错误：', error))
await bot.start()
