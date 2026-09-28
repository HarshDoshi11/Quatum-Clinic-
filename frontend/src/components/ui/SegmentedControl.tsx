import { motion, useReducedMotion } from 'motion/react'
import { useId, useRef, type KeyboardEvent } from 'react'
import { tIndicator } from '@/lib/motion'

export interface SegmentedChoice {
  value: number
  label: string
}

interface SegmentedControlProps {
  /** id of the visible label (radiogroup name). */
  labelledBy: string
  options: readonly SegmentedChoice[]
  /** null = none selected (e.g. a missing value). */
  value: number | null
  onChange: (value: number) => void
  /** Marks a value the user changed (what-ifs): the indicator turns accent. */
  changed?: boolean
}

/**
 * Form choice as a row of buttons (categorical and yes/no inputs). The selection indicator
 * slides between options; the row wraps when labels are long. Radiogroup semantics:
 * arrow keys move and select, Tab leaves the group.
 */
export function SegmentedControl({ labelledBy, options, value, onChange, changed = false }: SegmentedControlProps) {
  const id = useId()
  const reduced = useReducedMotion() ?? false
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const index = options.findIndex((o) => o.value === value)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const dir = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (dir === 0) return
    event.preventDefault()
    const next = (Math.max(0, index) + dir + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} onKeyDown={onKeyDown} className="flex flex-wrap gap-1">
      {options.map((o, i) => {
        const active = i === index
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (index < 0 && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`relative inline-flex h-8 items-center rounded-[2px] border px-3 type-small transition-colors duration-150 ${
              active ? 'border-transparent text-bg' : 'border-rule text-muted hover:border-rule-strong hover:text-ink'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`${id}-indicator`}
                transition={reduced ? { duration: 0 } : tIndicator}
                className={`absolute inset-0 rounded-[2px] ${changed ? 'bg-accent' : 'bg-ink'}`}
                aria-hidden="true"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
