import test from 'node:test'
import assert from 'node:assert/strict'
import { validateConfig, selectRoom, newMatches, matchText } from './logic.mjs'
test('只接受有效账号、群名及 HTTPS 站点', () => {
  assert.equal(validateConfig({ DOTA_ACCOUNT_ID: '12345', WECHAT_ROOM_NAME: '仇立群' }).room, '仇立群')
  assert.throws(() => validateConfig({ DOTA_ACCOUNT_ID: 'x', WECHAT_ROOM_NAME: '仇立群' }))
  assert.throws(() => validateConfig({ DOTA_ACCOUNT_ID: '123', WECHAT_ROOM_NAME: '仇立群', MATCH_SITE_ORIGIN: 'http://example.com' }))
})
test('群必须精确匹配且唯一', () => {
  assert.equal(selectRoom([{ topic: '仇立群', room: 1 }], '仇立群'), 1)
  assert.throws(() => selectRoom([{ topic: '仇立群', room: 1 }, { topic: '仇立群', room: 2 }], '仇立群'))
})
test('按时间顺序获取新比赛，缺失游标则停止', () => {
  assert.deepEqual(newMatches([{ match_id: 3 }, { match_id: 2 }, { match_id: 1 }], '1').map(m => m.match_id), [2, 3])
  assert.throws(() => newMatches([{ match_id: 3 }], '1'))
})
test('战绩按阵营计算胜负并生成站内链接', () => {
  assert.match(matchText({ match_id: 3, player_slot: 128, radiant_win: false, hero_id: 1, kills: 1, deaths: 2, assists: 3 }, '123', 'https://example.com'), /胜利[\s\S]*https:\/\/example.com\/matches\/3/)
})
