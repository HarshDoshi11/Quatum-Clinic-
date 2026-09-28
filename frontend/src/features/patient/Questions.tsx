import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { decimalsOf } from '@/components/ui/Field'
import { tGentle } from '@/lib/motion'
import type { FeatureSpec } from '@/types'
import { PATIENT_ICONS } from './icons'

/** "Not sure" = not recorded: the pipeline fills it in, and too many of them means no result. */
export const NOT_SURE = 'Not sure'

function QuestionLabel({ feature: f, id }: { feature: FeatureSpec; id: string }) {
  const Icon = PATIENT_ICONS[f.icon]
  return (
    <span id={id} className="flex items-center gap-3 type-body-lg text-ink">
      <Icon size="1.25rem" strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
      {f.question}
    </span>
  )
}

/**
 * Yes/no and category questions: large option buttons (≥ 48px tall) plus "Not sure". The selection
 * fills softly (a sage tint that glides between options). Radiogroup: arrows move and select.
 */
export function OptionQuestion({ feature: f, value, onChange }: { feature: FeatureSpec; value: number | null; onChange: (v: number | null) => void }) {
  const id = useId()
  const reduced = useReducedMotion() ?? false
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const choices: { value: number | null; label: string }[] = [...(f.options ?? []), { value: null, label: NOT_SURE }]
  const index = choices.findIndex((c) => c.value === (value === null ? null : Math.round(value)))

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = (Math.max(0, index) + dir + choices.length) % choices.length
    onChange(choices[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div>
      <QuestionLabel feature={f} id={`${id}-label`} />
      <div role="radiogroup" aria-labelledby={`${id}-label`} onKeyDown={onKeyDown} className="mt-4 flex flex-wrap gap-2">
        {choices.map((c, i) => {
          const active = i === index
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
              tabIndex={active || (index < 0 && i === 0) ? 0 : -1}
              onClick={() => onChange(c.value)}
              className={`relative inline-flex min-h-12 items-center rounded-panel border px-5 type-body-lg transition-colors duration-300 ${
                active ? 'border-accent text-ink' : unsure ? 'border-dashed border-rule-strong text-muted hover:text-ink' : 'border-rule-strong text-ink hover:border-ink'
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
              <span className="relative">{c.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Number questions: a large input with its unit, a friendly range hint while focused, and "Not sure".
 * Values outside the usual range are allowed; the result then explains why it can't be given.
 */
export function NumberQuestion({ feature: f, value, onChange }: { feature: FeatureSpec; value: number | null; onChange: (v: number | null) => void }) {
  const id = useId()
  const fmt = (v: number | null) => (v === null ? '' : String(Number(v.toFixed(decimalsOf(f.step)))))
  const [text, setText] = useState(fmt(value))
  const [focused, setFocused] = useState(false)
  // Keep the typed text while editing; sync when the value changes elsewhere (e.g. "Not sure").
  useEffect(() => {
    setText((t) => {
      const parsed = t.trim() === '' ? null : Number(t)
      return parsed === value ? t : fmt(value)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fmt only depends on the step
  }, [value, f.step])
  const bound = (v: number) => `${Number(v.toFixed(4))}${f.unit ? `\u00a0${f.unit}` : ''}`
  const unsure = value === null

  return (
    // The range hint overlays the gap below (shown on focus), so it never moves the questions.
    <div className="relative">
      <label htmlFor={id} className="block">
        <QuestionLabel feature={f} id={`${id}-label`} />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative w-[14rem]">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            placeholder="—"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              const t = e.target.value
              setText(t)
              if (t.trim() === '') onChange(null)
              else if (!Number.isNaN(Number(t))) onChange(Number(t))
            }}
            aria-describedby={`${id}-hint`}
            className="h-14 w-full rounded-panel border border-rule-strong bg-transparent px-4 pr-20 type-body-lg text-ink outline-none transition-colors duration-300 focus-visible:border-accent"
          />
          {f.unit && <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 type-body text-muted">{f.unit}</span>}
        </div>
        <button
          type="button"
          aria-pressed={unsure}
          onClick={() => onChange(null)}
          className={`relative inline-flex min-h-12 items-center rounded-panel border border-dashed px-5 type-body-lg transition-colors duration-300 ${
            unsure ? 'border-accent bg-accent-soft text-ink' : 'border-rule-strong text-muted hover:text-ink'
          }`}
        >
          {NOT_SURE}
        </button>
      </div>
      <p id={`${id}-hint`} className={`absolute top-full left-0 mt-2 type-body text-muted transition-opacity duration-300 ${focused ? 'opacity-100' : 'opacity-0'}`}>
        Most people are between {bound(f.min)} and {bound(f.max)}.
      </p>
    </div>
  )
}
