import { motion, useReducedMotion } from 'motion/react'
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { easeGentle } from '@/lib/motion'

export interface PillOption<T extends string> {
  value: T
  label: ReactNode
  /** Accessible name when the label is an icon. */
  ariaLabel?: string
  /** BCP 47 language of the label (e.g. "hi" for हिन्दी), so screen readers pronounce it. */
  lang?: string
}

/** Patient Mode's small switch: a soft indicator slides between options. Radiogroup: arrows move and select. */
export function PillSwitch<T extends string>({ options, value, onChange, label, layoutId }: { options: PillOption<T>[]; value: T; onChange: (v: T) => void; label: string; layoutId: string }) {
  const reduced = useReducedMotion() ?? false
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const index = options.findIndex((o) => o.value === value)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = (index + dir + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className="inline-flex items-center gap-0.5 rounded-control border border-rule p-0.5">
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
            aria-label={o.ariaLabel}
            lang={o.lang}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`relative inline-flex h-8 items-center justify-center rounded-[0.6rem] px-2.5 type-small transition-colors duration-300 ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-[0.6rem] bg-accent-soft"
                transition={reduced ? { duration: 0 } : { duration: 0.35, ease: easeGentle }}
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
