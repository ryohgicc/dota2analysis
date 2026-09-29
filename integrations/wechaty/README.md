# 普通微信群战绩推送试验（Wechaty）

本目录与网站、Cloudflare 部署分开运行。Wechaty 负责连接个人微信；`wechaty-puppet-wechat` 使用网页版微信。**是否能扫码登录取决于账号是否有网页版权限**，桌面微信已登录并不能证明网页方式可用。当前仅支持一个公开的 Steam 32 位账号和一个唯一名称的普通微信群。

## 安装和首次运行

需要 Node.js 22+、可运行的 Chrome/Chromium，以及一台持续在线的电脑。在此目录运行：

```bash
npm ci --ignore-scripts
DOTA_ACCOUNT_ID=你的Steam32位账号ID WECHAT_ROOM_NAME=仇立群 npm start
```

只验证登录和群名时可运行 `WECHAT_LOGIN_PROBE=1 WECHAT_ROOM_NAME=仇立群 npm start`；此模式不会发送消息，也不会查询战绩。

Mac 默认使用 `/Applications/Google Chrome.app`；若 Chrome 在其他位置，设置 `WECHATY_PUPPET_WECHAT_ENDPOINT` 为可执行文件绝对路径。此安装方式跳过历史 Puppeteer 自动下载的 Chromium。扫码信息打印在终端，需要用微信扫码确认网页版登录。旧版 Puppet 在这台 Mac 的 Chrome 上等待页面完全加载会超时，因此入口对 `wx.qq.com` 的导航改用 `domcontentloaded` 条件，并在重载后通知旧版 Puppet 页面可用；这只能排除页面加载超时，不代表扫码登录已成功。**请先使用测试微信号**；网页版连接并非官方机器人接口，可能无法登录或导致账号限制。

首次成功登录会精确查找群名；0 个或多个同名群均停止发送。然后将当时最新比赛记为基线，不推送旧比赛。之后每 15 分钟查询 OpenDota 最近 20 场；有新比赛按旧到新发送“胜负、英雄 ID、KDA、复盘链接”。若游标落在 20 场以外会暂停，防止漏发被误认为正常。

发送前在 `.state/push.json` 写入 `pending`；调用发送接口返回后更新 `lastMatchId`。如果进程在发送时中断，下一次启动会暂停，需人工核对微信中该比赛是否出现，再更新状态（已送达：将 `lastMatchId` 改为 `pending`；未送达：保留原 `lastMatchId`），最后把 `pending` 设为 `null`。`room.say()` 返回仅代表发送接口响应，不能证明群成员实际收到。

`MATCH_SITE_ORIGIN` 可选，默认为 `https://dota2analysis.pages.dev`。`.state/` 和 `*.memory-card.json` 包含推送状态或会话数据，已加入仓库忽略列表；不要上传、共享或删除尚未核查的状态文件。运行 `npm run check` 检查纯逻辑。因为本项目依赖的网页版 Puppet 使用旧版 Puppeteer 等历史依赖，启用前还应评估 `npm audit --omit=dev` 的结果；不要将其暴露成公网消息 API。

本机启动探测已显示网页微信扫码二维码；**尚未确认扫码登录、群聊识别或实际群发成功**。网页登录可用性是上线前必须跨过的门槛。
