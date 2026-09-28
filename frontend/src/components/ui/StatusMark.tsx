import type { TrustLevel } from '@/types'

export const TRUST_LABEL: Record<TrustLevel, string> = { strong: 'Strong', partial: 'Partial', weak: 'Weak' }

/** Filled / half / empty square for strong / partial / weak evidence. Shape carries the meaning, not colour. */
export function StatusMark({ level, className = '' }: { level: TrustLevel; className?: string }) {
  return (
    <span role="img" aria-label={`${TRUST_LABEL[level]} evidence`} className={`relative inline-block h-[0.75rem] w-[0.75rem] shrink-0 border border-ink ${className}`}>
      {level !== 'weak' && <span className={`absolute inset-y-0 left-0 bg-ink ${level === 'strong' ? 'right-0' : 'right-1/2'}`} aria-hidden="true" />}
    </span>
  )
}
