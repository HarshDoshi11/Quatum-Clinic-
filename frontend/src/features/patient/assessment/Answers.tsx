import { motion, useReducedMotion } from 'motion/react'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { decimalsOf } from '@/components/ui/Field'
import { tGentle } from '@/lib/motion'
import type { FeatureSpec } from '@/types'

/** One answer card. `unsure` is the equal "I'm not sure" / "It's not on my report" option (dashed). */
export interface AnswerChoice {
  value: number | null
  label: string
  example?: string
}

interface ChoiceAnswerProps {
  labelledBy: string
  choices: AnswerChoice[]
  /** Index of the chosen card, or −1. */
  selected: number
  onPick: (choice: AnswerChoice) => void
  /** Enter on a card picks it and moves on. */
  onCommit: (choice: AnswerChoice) => void
}

/**
 * Answers as cards (a radiogroup): plain labels with an optional example line, the last card the equal
 * "not sure" option. Arrows move and pick; Enter picks and moves on. The selection fills softly and glides.
 */
export function ChoiceAnswer({ labelledBy, choices, selected, onPick, onCommit }: ChoiceAnswerProps) {
  const id = useId()
  const reduced = useReducedMotion() ?? false
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const rich = choices.some((c) => c.example)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = (Math.max(0, selected) + (selected < 0 ? 0 : dir) + choices.length) % choices.length
    onPick(choices[next])
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
      className={rich ? 'grid grid-cols-1 gap-3 md:grid-cols-2' : 'flex flex-wrap gap-3'}
    >
      {choices.map((c, i) => {
        const active = i === selected
        const unsure = c.value === null
        return (
          <button
            key={c.label}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (selected < 0 && i === 0) ? 0 : -1}
            data-autofocus={active || (selected < 0 && i === 0) ? '' : undefined}
            onClick={() => onPick(c)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              e.stopPropagation()
              onCommit(c)
            }}
            className={`relative flex min-h-14 flex-col justify-center rounded-panel border text-left transition-colors duration-300 ${rich ? 'px-5 py-3' : 'min-w-[8rem] px-6'} ${
              active ? 'border-accent' : unsure ? 'border-dashed border-rule-strong hover:border-ink' : 'border-rule-strong hover:border-ink'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`${id}-fill`}
                className="absolute inset-0 rounded-panel bg-accent-soft"
                transition={reduced ? { duration: 0 } : tGentle}
                aria-hidden="true"
              />
            )}
            <span className={`relative type-body-lg ${unsure && !active ? 'text-muted' : 'text-ink'}`}>{c.label}</span>
            {c.example && <span className="relative type-body text-muted">{c.example}</span>}
          </button>
        )
      })}
    </div>
  )
}

interface NumberAnswerProps {
  feature: FeatureSpec
  labelledBy: string
  describedBy: string
  value: number | null
  onChange: (v: number | null) => void
}

/** A large number box with its unit. Any number is accepted (outside the usual range gets a gentle note). */
export function NumberAnswer({ feature: f, labelledBy, describedBy, value, onChange }: NumberAnswerProps) {
  const [text, setText] = useState(value === null ? '' : String(Number(value.toFixed(decimalsOf(f.step)))))
  return (
    <div className="relative w-[16rem]">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        data-autofocus=""
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(',', '.')
          setText(t)
          const n = t.trim() === '' ? null : Number(t)
          onChange(n === null || Number.isNaN(n) ? null : n)
        }}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className="h-16 w-full rounded-panel border border-rule-strong bg-transparent px-5 pr-24 type-h2 text-ink outline-none transition-colors duration-300 focus-visible:border-accent"
      />
      {f.unit && <span className="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2 type-body-lg text-muted">{f.unit}</span>}
    </div>
  )
}
