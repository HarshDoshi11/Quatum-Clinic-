import { motion, useReducedMotion } from 'motion/react'
import type { RiskBand } from '@/types'

const FILL: Record<RiskBand, string> = { low: 'var(--risk-low)', moderate: 'var(--risk-mid)', high: 'var(--risk-high)' }
/** Total time for the filled figures to appear one by one. */
const FILL_SECONDS = 1.2

/** A simple person: head and shoulders, drawn in a 20×24 box. */
const HEAD = { cx: 10, cy: 6, r: 4.25 }
const BODY = 'M3 23.25C3 16.9 6.1 13.25 10 13.25s7 3.65 7 10Z'

function Person({ filled, colour, delay, animate }: { filled: boolean; colour: string; delay: number; animate: boolean }) {
  return (
    <svg viewBox="0 0 20 24" className="block h-auto w-full" aria-hidden="true">
      <g fill="none" stroke="var(--rule-strong)" strokeWidth={1.25}>
        <circle {...HEAD} />
        <path d={BODY} />
      </g>
      {filled && (
        <motion.g
          fill={colour}
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, delay, ease: 'easeOut' }}
        >
          <circle {...HEAD} />
          <path d={BODY} />
        </motion.g>
      )}
    </svg>
  )
}

/**
 * 100 people as a 10×10 grid: `filled` of them in the risk colour (one by one, once, ≤ 1.5s),
 * the rest outlined. With no result (`filled` null) every figure is outlined, with a soft "?".
 */
export function PeopleGrid({ filled, band, className = '' }: { filled: number | null; band: RiskBand | null; className?: string }) {
  const reduced = useReducedMotion() ?? false
  const n = filled ?? 0
  const colour = band ? FILL[band] : 'var(--ink)'
  const label = filled === null ? 'No result: 100 outlined figures' : `${n} of 100 figures filled`
  return (
    <div className={`relative [print-color-adjust:exact] ${className}`} role="img" aria-label={label}>
      <div className="grid grid-cols-10 gap-x-[0.4rem] gap-y-[0.3rem]">
        {Array.from({ length: 100 }, (_, i) => (
          <Person key={i} filled={i < n} colour={colour} delay={(i / Math.max(1, n)) * FILL_SECONDS} animate={!reduced} />
        ))}
      </div>
      {filled === null && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-bg/90 font-serif text-muted type-h2">?</span>
        </span>
      )}
    </div>
  )
}
