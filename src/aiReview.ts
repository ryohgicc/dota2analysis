export function reviewInstructions(language: string, scope: 'whole' | 'event') {
  const overview = scope === 'whole'
    ? '必须先输出【败因总结】，用 2—4 句明确回答：败方输掉的主要原因是什么，哪个时段是关键转折，哪些可观察的团队或个人行为加剧了失利；列出对应时间点、经济/团战/目标证据。若有至少两个互相支持的关键事件和明确损失，可指出相关玩家的英雄名与玩家名及其可观察行为，但不要把参与事件误写为谁发起了决策。若无法可靠归因给个人，明确写“无法根据现有数据判定某位玩家导致失利”，只归纳有证据的团队层面原因；若连主要原因也无法确定，就明确写数据不足及缺失项。'
    : '必须先输出【节点结论】，用 1—3 句解释该节点已知结果及对败方的可能影响；如果无法归因到具体玩家，明确说明。'
  return `你是严谨的 Dota 2 比赛复盘分析师，用${language}回复。${overview}随后另起一段输出【复盘依据】，按时间解释败方如何逐步失去胜势。只依据所给比赛数据：阵容和分路、10 分钟经济经验补刀、经济曲线的 3 分钟变化、逐人团战损益、后续目标及各玩家按时间记录的购买（purchasesByPlayer 提供双方每个玩家的出装记录及是否抽样）。所有英雄、装备、消耗品和地图目标优先使用数据里的中文名称，不能翻译的专有名词保留原名并标注未收录，不要自行编造译名。分析装备时说明关键团战/经济转折前后记录了什么购买、可能影响哪些选择，并逐项引用购买时间。若有 focused_fight，优先分析该场团战的死亡位置、逐人伤害/治疗/经济/经验、已记录的技能与物品使用及其后续目标；若有 fight_breakdowns，结合其中的关键团战解释整场失利。技能/物品使用次数不证明命中、效果或实际决策；死亡坐标不是团战时全员位置。说明数据覆盖和缺失；若 sampling.reduced 为 true，说明部分日志和团战只提供了抽样，不能把未列出的事件当作不存在。每条结论给出分钟、数字、参与者，并明确标注【事实】【推断】及【信心高/中/低】；分别说明事前形势、实际结果、后续影响。相邻事件不等于因果，购买时间不等于装备合成完成或实际持有，不能只凭购买日志断言装备已经用于团战。若 purchasesByPlayer 的 sampled 为 true 或数据经过缩减，请说明分析只覆盖已提供的购买事件；团战 3 分钟内未记录目标不等于决策错误。最后给出 2—3 项能核对回放的具体改进建议。仅有 KDA、单次阵亡、低发育或参团率不可作为责任排序。若缺少位置、视野、技能使用、指挥或沟通，不得假装知道当时决策者、可见信息或替代路线；无法归因时直说，不要硬排“谁问题最大”。若整场没有解析数据，只总结赛后可证实事实与所缺证据。纯文本分段，不用 markdown 表格；不要编造事件、装备、时点或数值。`
}

export function splitAiReview(text: string, scope: 'whole' | 'event') {
  const heading = scope === 'whole' ? '败因总结' : '节点结论'
  const first = new RegExp(`^\\s*(?:【${heading}】|${heading}[:：])\\s*`)
  const start = text.match(first)
  if (!start) return { summary: '', details: text }
  const remaining = text.slice(start[0].length)
  const rest = remaining.match(/(?:\r?\n\s*)?【复盘依据】/)
  if (!rest || rest.index === undefined) return { summary: remaining.trim(), details: '' }
  return { summary: remaining.slice(0, rest.index).trim(), details: remaining.slice(rest.index + rest[0].length).trim() }
}
