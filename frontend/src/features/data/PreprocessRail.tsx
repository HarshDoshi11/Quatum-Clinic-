import { motion, useReducedMotion } from 'motion/react'
import { easePrecise } from '@/lib/motion'
import type { PreprocessStep } from '@/types'

interface PreprocessRailProps {
  steps: PreprocessStep[]
  /** Index of the last completed step; -1 = nothing yet. The parent advances it on a timer. */
  progress: number
  running: boolean
}

/** Time per step; the parent's timer uses the same value. */
export const PREPROCESS_STEP_MS = 420

const pct = (i: number, n: number) => `${(i / (n - 1)) * 100}%`

/**
 * Preprocessing steps as nodes on a line. While `running`, a dot travels
 * node to node; each node fills as the dot arrives. Horizontal when the
 * container is ≥ 60rem, vertical list otherwise (labels need the room).
 */
export function PreprocessRail({ steps, progress, running }: PreprocessRailProps) {
  const reduced = useReducedMotion() ?? false
  const n = steps.length

  const filled = (i: number) => i <= progress
  const isLast = (i: number) => i === n - 1

  const node = (i: number) => (
    <span
      className={`block h-[14px] w-[14px] border transition-colors duration-300 ${
        filled(i) ? (isLast(i) ? 'border-accent bg-accent' : 'border-ink bg-ink') : 'border-rule-strong bg-bg'
      }`}
      aria-hidden="true"
    />
  )

  return (
    // Horizontal only when all steps fit (container query in rem, so projector mode is respected).
    <div className="@container">
      {/* Horizontal */}
      <div className="relative hidden h-[10rem] px-[3.75rem] @min-[60rem]:block">
        <div className="relative h-full">
          <div className="absolute top-[7px] right-0 left-0 h-px bg-rule-strong" aria-hidden="true" />
          <motion.div
            className="absolute top-[7px] left-0 h-px bg-ink"
            initial={false}
            animate={{ width: progress < 0 ? '0%' : pct(Math.min(progress, n - 1), n) }}
            transition={{ duration: reduced ? 0 : PREPROCESS_STEP_MS / 1000, ease: 'linear' }}
            aria-hidden="true"
          />
          {running && !reduced && (
            <motion.span
              className="absolute top-[4px] z-10 block h-[7px] w-[7px] -translate-x-1/2 bg-accent"
              initial={{ left: '0%' }}
              animate={{ left: pct(Math.max(0, Math.min(progress + 1, n - 1)), n) }}
              transition={{ duration: PREPROCESS_STEP_MS / 1000, ease: easePrecise }}
              aria-hidden="true"
            />
          )}
          <ol className="absolute inset-0" aria-label="Preprocessing steps">
            {steps.map((s, i) => (
              <li key={s.id} className="absolute top-0 flex w-[7.5rem] -translate-x-1/2 flex-col items-center text-center" style={{ left: pct(i, n) }}>
                {node(i)}
                <span className={`mt-4 type-ui ${filled(i) ? 'text-ink' : 'text-muted'}`}>{s.label}</span>
                <span className="mt-1 type-small text-muted">{s.detail}</span>
                <span className="sr-only">{filled(i) ? '(done)' : '(pending)'}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Vertical (narrow) */}
      <ol className="relative border-l border-rule-strong pl-6 @min-[60rem]:hidden" aria-label="Preprocessing steps">
        {steps.map((s, i) => (
          <li key={s.id} className="relative pb-5 last:pb-0">
            <span className="absolute top-[5px] -left-[31px]">{node(i)}</span>
            <p className={`type-ui ${filled(i) ? 'text-ink' : 'text-muted'}`}>{s.label}</p>
            <p className="type-small text-muted">{s.detail}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}
