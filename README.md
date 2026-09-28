# 视界 · Dota 2 比赛复盘

基于 [OpenDota](https://www.opendota.com/) 公开数据的中文战绩与比赛复盘网页。可以关注玩家、比较近期表现、按英雄和模式查看胜率，并在比赛时间轴、团战明细与出装记录中查找失利线索。支持通过自选的 OpenAI 兼容模型生成中文分析。

## 功能

- **我的账号与关注**：输入 Steam 32 位账号 ID 或 SteamID64 单独绑定自己的账号，关注其他玩家；查看最近 5 场比赛、近 5/10/20/100 场统计和五维雷达图，以及按模式、英雄和胜负筛选的历史记录、英雄胜率。查看其他玩家时可开启「和我对比」，查看双方同一窗口的胜率、场均 K/D/A、KDA、英雄数及叠加五维图。双方分别取各自最近的公开比赛，可能并非同一时段；样本不足时标示实际场数。
- **比赛总览**：查看双方比分、十名玩家战绩与终场装备；点击有公开账号 ID 的玩家名称进入站内个人主页。英雄和已收录装备显示简体中文名称。
- **全场复盘**：查看 10 分钟发育、经济变化区间、主要地图目标，以及团战、击杀和十名玩家购买记录的时间轴。购买记录可以按玩家筛选。
- **团战明细**：逐场查看双方玩家的伤害、治疗、经济和经验变化、技能与物品使用次数，以及有记录的死亡位置。团战中阵亡的英雄头像会置灰并标记「×」。
- **AI 分析**：选择整场或特定团战，让模型结合抽取的经济转折、关键团战和关键时段购买记录判断对局是碾压、均势还是翻盘，并从选手、阵容、对线和团战解释胜负关键；设置页可测试当前模型连接。
- **请求解析**：比赛缺少解析日志或尚未收录时，可一键向 OpenDota 提交比赛 ID 请求解析，等待后刷新查看结果。

## Cloudflare 免费部署

Cloudflare Pages 托管 `dist/` 静态页面，Pages Functions 提供 OpenDota 数据、解析请求、AI 任务提交和健康检查。独立的 Cloudflare Workflow Worker 在后台分段处理 AI 复盘；关闭网页后任务继续运行。任务状态与最终共享结果写入 D1，首页的 AI 分析历史显示整场和节点的处理进度及最终结果。关注列表和“我的账号”仍留在每个人的浏览器里。

首次部署：

```bash
npm ci
npx wrangler login
npx wrangler d1 create dota2analysis
```

将 `wrangler d1 create` 返回的数据库 ID 同时填入 `wrangler.toml` 和 `worker/wrangler.toml` 的 `database_id`。创建 Pages 项目，然后为 Pages 和后台 Worker 配置**相同**的随机 32 字节十六进制密钥（不要提交到仓库）：

```bash
npx wrangler pages project create dota2analysis --production-branch main
npm run d1:migrate:remote
npm run deploy:worker
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
npx wrangler pages secret put AI_JOB_SECRET --project-name dota2analysis
npx wrangler secret put AI_JOB_SECRET --config worker/wrangler.toml
npx wrangler pages secret put OPEN_DOTA_API_KEY --project-name dota2analysis
npm run deploy
```

首次部署先建立 Worker，再设置 Worker 密钥，最后部署 Pages。密钥只生成一次，将输出值分别输入到两条 `secret put` 命令的提示中。`npm run deploy` 先构建和迁移远端 D1，再部署独立 Worker，最后部署 Pages；任务提交依赖 `WORKFLOW_SERVICE` 服务绑定。部署后确认 `/api/health`、比赛页面、任务接口和历史列表，实际提交一场分析，关闭页面再重新打开查看结果。

本地预览前运行 `npm run build` 和 `npm run d1:migrate:local`。本地后台任务需用 Wrangler 同时启动 Worker 和 Pages，并配置本地 `AI_JOB_SECRET`；单独的 Express 预览只提供普通页面与 API，不运行 Cloudflare Workflow。

Cloudflare Pages 的构建输出目录是 `dist`；部署命令会自动构建。模型 API Key 由使用者在页面填写，后台任务提交时以 AES-GCM 加密后存入 Workflow 参数；Pages 和 Worker 使用同一个 `AI_JOB_SECRET` 解密，密钥及模型 API Key 均不可提交仓库。工作流运行期会持有可解密的参数，Cloudflare 免费版完成后的 Workflow 状态保留最多 3 天。对公网开放后应给 AI 转发接口配置限流与访问控制；当前接口验证 HTTPS 和公网 DNS 地址，不提供全局使用额度管理。

## 本地运行

需要 Node.js 22+ 和 npm。克隆仓库后运行：

```bash
npm ci
npm run build
npm run start
```

再打开 <http://127.0.0.1:3001>。`npm run start` 启动 Express API 并提供已构建的静态页面；修改前端后需重新运行 `npm run build`。

开发时用两个终端分别启动：

```bash
npm run start
npm run dev
```

开发页面在 <http://127.0.0.1:5173>，Vite 将 `/api` 代理到 `127.0.0.1:3001`。API 默认仅监听本机；可以通过 `PORT=3002 npm run start` 修改端口，同时需要修改 `vite.config.ts` 中的开发代理地址。本项目无需数据库或环境变量；关注名单和“我的账号”绑定仅保存在当前浏览器的 `localStorage`；绑定或更换自己的账号会从关注名单移除同一账号，解除绑定不会自动关注。

玩家个人资料、英雄表现和各筛选条件下的比赛记录会在当前标签页缓存 2 分钟；期间重新进入玩家详情页直接显示已缓存的数据并减少重复请求。缓存过期后重新获取；失败请求不缓存。

## 如何使用 AI 分析

1. 打开比赛复盘页，输入数字比赛 ID。可用 `9018403896` 试用；比赛可查看的内容取决于 OpenDota 当前是否已收录及解析。
2. 在 AI 设置中填写兼容 OpenAI 聊天补全接口的 **HTTPS Base URL**（通常截至 `/v1`）、API Key 和模型 ID。点击「测试连接」确认配置，再保存。
3. 在比赛页选择整场分析，或先选定团战再分析该节点。页面提交后台任务后可关闭；Worker 会分段整理证据并生成完整复盘，首页 AI 分析历史和比赛页显示进度，完成后保存并展示整场或节点结果。历史按比赛与分析范围保存最新结果，重新分析同一范围会覆盖旧结果。每段及最终生成都是单独的模型调用，测试连接和正式分析都可能产生模型费用。

模型服务返回 524 表示上游响应超时；每次模型请求最多等待约 60 秒。分段可降低单次请求的负担，但服务端排队或生成较慢时仍可能超时；遇到这种情况可稍后重试或选择响应更快的模型。

API Key 是否保留在浏览器由 AI 设置的“记住 API Key”选项控制；后台任务会将加密后的 API Key 存入 Workflow 参数，以便关页后继续调用模型。请只填写可信的服务地址。AI 的结论可能有误，应结合真实回放核查。

## 数据范围与局限

比赛事件、团战及购买记录来自 OpenDota 的公开数据。未解析的比赛可能只提供赛后统计；个人历史可能受 Steam 隐私设置和 OpenDota 收录状态影响。终场装备栏是赛后快照，购买日志表示购买动作，并不能证明物品已经合成或在团战中实际持有。死亡坐标不是所有英雄的行动轨迹，技能使用次数不代表命中。经济变化与同时段事件只能提供复盘线索，不能单凭 KDA、单次阵亡或时间相近就认定某位玩家导致失利；位置、视野和团队沟通等信息可能缺失。

近 5/10/20/100 场统计按当前可用的最新公开比赛计算；样本不足时按实际场数展示。雷达图的胜率、场均击杀、场均助攻、场均生存和英雄覆盖使用页面标示的固定换算刻度，不是官方评分。

## 技术与数据来源

- 前端：React、TypeScript、Vite、React Router、Recharts。
- 服务端：Express 代理 OpenDota API 和自选模型的聊天补全接口，静态页面从 `dist/` 提供。对模型地址设有公网 HTTPS 检查；若对公网开放服务，还需要自行配置认证、限流和出口控制。
- 英雄名称映射 `src/heroes.json` 与物品 ID 映射 `src/item-ids.json` 来自 OpenDota 常量数据；英雄图片来自 Valve CDN。
- 已收录英雄、物品和技能的中文名称参考 [opendota-mcp](https://github.com/yuxiang115/opendota-mcp) 的 `locales/schinese`，许可见 `licenses/opendota-mcp-MIT.txt`。团战地图图片来自 [OpenDota Web](https://github.com/odota/web)，许可见 `licenses/opendota-web-MIT.txt`。数据与设计还参考 [OpenDota Core](https://github.com/odota/core) 和 [dotaconstants](https://github.com/odota/dotaconstants)；没有复制其页面源码。

当前不提供 `.dem` 回放解析或完整视野、移动轨迹和技能命中数据。

## 检查

```bash
npm test
npm run lint
npm run build
```

## 变更记录

- AI 分析移至 Cloudflare Workflow 后台任务；分段处理中关闭页面不影响生成，首页展示任务进度和整场/节点历史，并用加密参数传递模型 API Key。新增 D1 任务表及独立 Worker 部署。

- AI 复盘改为分段整理比赛证据并生成最终答案，页面显示进度；只有最终答案会保存为共享分析。

- 为 AI 请求增加 60 秒超时，并将模型服务 524 转为明确的超时提示；不向页面展示上游报错正文。

- AI 复盘请求压缩至约 12,000 字符，优先保留经济转折、影响最大的团战和相近时段的购买记录，并标注抽样；减少模型处理时间。

- 0.2.12：玩家详情及近期对比数据增加当前标签页两分钟缓存，重复进入时即时显示；缓存按账号与筛选条件区分。

- 0.2.11：单独绑定“我的账号”，并在其他玩家近 5/10/20/100 场统计中加入同口径的双人指标和五维图对比。

- 0.2.10：比赛战绩、团战与对线表的玩家姓名链接至站内个人主页。
- 0.2.9：新增逐场团战地图、逐人损益及技能/物品使用数据，并支持 AI 分析选定团战。
- 0.2.8：新增向 OpenDota 提交比赛解析请求。
- 0.2.7：重排比赛详情，增加双方战绩和终场装备快照。
- 0.2.6：AI 分析增加败因总结与中文名称补全。
- 0.2.5：AI 设置新增测试连接。
- 0.2.4：玩家主页新增近 5/10/20/100 场统计和五维雷达图。
- 0.2.3：调整玩家主页比赛记录与英雄表现的顺序。
- 0.2.2：增加英雄、物品中文名称，购买记录并入时间轴与 AI 证据。
- 0.2.1：玩家主页新增近期比赛列表。
- 0.2.0：增加默认可见的全场复盘线索与数据覆盖提示。
- 0.1.0：新增玩家关注、历史战绩、比赛时间轴及 AI 决策分析。
