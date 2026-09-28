import type { RecentMatch } from './data'
import { earnedTrumpetRules, trumpetRules } from './trumpetRules'

export { trumpetRules }
export function earnedTrumpets(matches: RecentMatch[]): string[] { return earnedTrumpetRules(matches) }
