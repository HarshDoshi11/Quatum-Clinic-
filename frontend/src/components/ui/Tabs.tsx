import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { panelSwap, springIndicator } from '@/lib/motion'

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
  panel: ReactNode
  /** Small accent dot after the label (e.g. "this group has changed inputs"), with its screen-reader text. */
  mark?: string
}

interface TabsProps<T extends string> {
  items: readonly TabItem<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
}

/**
 * Hairline tabs: the accent underline slides between tabs, and the panel crossfades with a
 * small vertical slide. ←/→, Home/End move between tabs (WAI-ARIA tabs, automatic activation).
 */
export function Tabs<T extends string>({ items, value, onChange, ariaLabel }: TabsProps<T>) {
  const id = useId()
  const reduced = useReducedMotion() ?? false
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const i = items.findIndex((t) => t.value === value)
    const next =
      event.key === 'ArrowRight'
        ? (i + 1) % items.length
        : event.key === 'ArrowLeft'
          ? (i - 1 + items.length) % items.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : -1
    if (next < 0) return
    event.preventDefault()
    onChange(items[next].value)
    refs.current[next]?.focus()
  }
  const current = items.find((t) => t.value === value)
  return (
    <div>
      <div role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown} className="flex gap-x-6 overflow-x-auto border-b border-rule">
        {items.map((t, i) => {
          const active = t.value === value
          return (
            <button
              key={t.value}
              ref={(el) => {
                refs.current[i] = el
              }}
              id={`${id}-tab-${t.value}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`${id}-panel`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(t.value)}
              className={`relative inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap type-small transition-colors duration-150 ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}
            >
              {t.label}
              {t.mark && (
                <>
                  <span className="block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                  <span className="sr-only">({t.mark})</span>
                </>
              )}
              {active && (
                <motion.span
                  layoutId={`${id}-underline`}
                  transition={reduced ? { duration: 0 } : springIndicator}
                  className="absolute inset-x-0 bottom-0 h-[2px] bg-accent"
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${value}`} className="pt-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={value} {...panelSwap} transition={reduced ? { duration: 0 } : panelSwap.transition}>
            {current?.panel}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
