import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { easeGentle, tGentle } from '@/lib/motion'

export interface SwitchSection<T extends string> {
  value: T
  label: string
  panel: ReactNode
}

/**
 * Patient Mode's segmented switch between sections: a soft indicator slides between options (layoutId),
 * and the content crossfades. WAI-ARIA tabs: ←/→ move, Home/End jump.
 */
export function SectionSwitch<T extends string>({ sections, value, onChange, label }: { sections: SwitchSection<T>[]; value: T; onChange: (v: T) => void; label: string }) {
  const id = useId()
  const reduced = useReducedMotion() ?? false
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const index = sections.findIndex((s) => s.value === value)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next =
      e.key === 'ArrowRight' ? (index + 1) % sections.length : e.key === 'ArrowLeft' ? (index - 1 + sections.length) % sections.length : e.key === 'Home' ? 0 : e.key === 'End' ? sections.length - 1 : -1
    if (next < 0) return
    e.preventDefault()
    onChange(sections[next].value)
    refs.current[next]?.focus()
  }
  const current = sections[index]
  return (
    <div>
      <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="inline-flex flex-wrap gap-1 rounded-panel border border-rule p-1">
        {sections.map((s, i) => {
          const active = i === index
          return (
            <button
              key={s.value}
              ref={(el) => {
                refs.current[i] = el
              }}
              id={`${id}-tab-${s.value}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`${id}-panel`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(s.value)}
              className={`relative min-h-12 rounded-control px-5 type-body-lg transition-colors duration-300 ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}
            >
              {active && (
                <motion.span
                  layoutId={`${id}-indicator`}
                  className="absolute inset-0 rounded-control bg-accent-soft"
                  transition={reduced ? { duration: 0 } : { duration: 0.35, ease: easeGentle }}
                  aria-hidden="true"
                />
              )}
              <span className="relative">{s.label}</span>
            </button>
          )
        })}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${value}`} className="mt-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={value}
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
            transition={tGentle}
          >
            {current?.panel}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
