export function ReasonBadge({ label, icon, reasons, className = '' }: { label: string; icon: string; reasons: string[]; className?: string }) {
  if (!reasons.length) return null
  const text = reasons.join('；')
  return <span className={`reason-badge ${className}`} role="img" tabIndex={0} aria-label={`${label}，${reasons.length} 个原因：${text}`} title={text}>{label}{icon.repeat(reasons.length)}</span>
}
