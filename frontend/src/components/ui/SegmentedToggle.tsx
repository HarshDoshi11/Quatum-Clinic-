import { motion } from 'motion/react'
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { springIndicator } from '@/lib/motion'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  /** Accessible label when `label` is an icon. */
  ariaLabel?: string
}

interface SegmentedToggleProps<T extends string> {
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Unique per toggle instance — drives the sliding indicator. */
  layoutId: string
  ariaLabel: string
  size?: 'sm' | 'md'
}

/**
 * Segmented control with a sliding indicator (radiogroup semantics:
 * arrow keys move and select, Tab leaves the group).
 */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  ariaLabel,
  size = 'md',
}: SegmentedToggleProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const dir = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (dir === 0) return
    event.preventDefault()
    const current = options.findIndex((o) => o.value === value)
    const next = (current + dir + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  const pad = size === 'sm' ? 'h-8 px-2' : 'h-8 px-3'

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="relative inline-flex items-stretch rounded-[2px] border border-rule p-[2px]"
    >
      {options.map((option, i) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.ariaLabel}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={`relative inline-flex items-center justify-center ${pad} type-label transition-colors duration-200 ${
              active ? 'text-bg' : 'text-muted hover:text-ink'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={springIndicator}
                className="absolute inset-0 rounded-[1px] bg-ink"
                aria-hidden="true"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
