import { motion, useReducedMotion } from 'motion/react'

/** Total time for the filled figures to appear one by one (≤ 1s). */
const FILL_SECONDS = 0.9

const HEAD = { cx: 10, cy: 6, r: 4.25 }
const BODY = 'M3 23.25C3 16.9 6.1 13.25 10 13.25s7 3.65 7 10Z'

/**
 * Ten people in a row: `filled` of them in soft coral (one by one, once), the rest outlined.
 * With no answer (`filled` null) every figure is outlined, with a soft "?" over the row.
 */
export function PeopleRow({ filled, className = '' }: { filled: number | null; className?: string }) {
  const reduced = useReducedMotion() ?? false
  const n = filled ?? 0
  return (
    <div
      className={`relative [print-color-adjust:exact] ${className}`}
      role="img"
      aria-label={filled === null ? 'No answer: ten outlined figures' : `${n} of 10 figures filled`}
    >
      <div className="grid grid-cols-10 gap-2">
        {Array.from({ length: 10 }, (_, i) => (
          <svg key={i} viewBox="0 0 20 24" className="block h-auto w-full" aria-hidden="true">
            <g fill="none" stroke="var(--rule-strong)" strokeWidth={1.1}>
              <circle {...HEAD} />
              <path d={BODY} />
            </g>
            {i < n && (
              <motion.g
                fill="var(--coral)"
                initial={reduced ? false : { opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ transformOrigin: '50% 60%' }}
                transition={{ duration: 0.3, delay: (i / Math.max(1, n)) * FILL_SECONDS, ease: 'easeOut' }}
              >
                <circle {...HEAD} />
                <path d={BODY} />
              </motion.g>
            )}
          </svg>
        ))}
      </div>
      {filled === null && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-rule bg-bg font-serif text-muted type-h2">?</span>
        </span>
      )}
    </div>
  )
}
