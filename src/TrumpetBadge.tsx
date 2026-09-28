import { earnedTrumpets } from './trumpets'
import type { RecentMatch } from './data'
import { ReasonBadge } from './ReasonBadge'

export function TrumpetBadge({ matches }: { matches?: RecentMatch[] }) {
  return <TrumpetCountBadge count={matches ? earnedTrumpets(matches).length : 0} reasons={matches ? earnedTrumpets(matches) : []}/>
}

export function TrumpetCountBadge({ count, reasons = [] }: { count?: number; reasons?: string[] }) {
  return <ReasonBadge label="" icon="🎺" reasons={count ? reasons : []} className="trumpet-badge" />
}
