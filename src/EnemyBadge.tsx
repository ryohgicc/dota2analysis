import { ReasonBadge } from './ReasonBadge'

export function EnemyBadge({ reasons }: { reasons?: string[] }) {
  return <ReasonBadge label="仇人" icon="👿" reasons={reasons || []} className="enemy-badge" />
}
