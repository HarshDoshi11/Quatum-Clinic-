import { motion, useReducedMotion } from 'motion/react'
import { easeGentle } from '@/lib/motion'
import { CONFIDENCE_WORD } from '@/lib/patientText'
import type { TrustLevel } from '@/types'

const LEVELS = ['Low', 'Medium', 'High'] as const
const FILLED: Record<TrustLevel, number> = { weak: 1, partial: 2, strong: 3 }

/** Three segments (Low / Medium / High confidence), filled from the trust checks; fills once on load. */
export function ConfidenceMeter({ level }: { level: TrustLevel }) {
  const reduced = useReducedMotion() ?? false
  const filled = FILLED[level]
  return (
    <div role="img" aria-label={`${CONFIDENCE_WORD[level]} confidence: ${filled} of 3`} className="max-w-[28rem]">
      <div className="grid grid-cols-3 gap-2" aria-hidden="true">
        {LEVELS.map((l, i) => (
          <span key={l} className="relative block h-2 overflow-hidden rounded-full bg-rule">
            {i < filled && (
              <motion.span
                className="absolute inset-y-0 left-0 rounded-full bg-accent [print-color-adjust:exact]"
                initial={reduced ? false : { width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 0.4, delay: i * 0.15, ease: easeGentle }}
              />
            )}
          </span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 type-body text-muted" aria-hidden="true">
        {LEVELS.map((l, i) => (
          <span key={l} className={i === filled - 1 ? 'text-ink' : ''}>
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}
