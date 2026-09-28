import { Check } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { decimalsOf } from '@/components/ui/Field'
import { easeGentle } from '@/lib/motion'
import { useT } from '@/state/language'
import type { FeatureSpec } from '@/types'

/** The round mark on an option card: empty, then a soft fill and a drawn check when chosen. */
function Mark({ on }: { on: boolean }) {
  const reduced = useReducedMotion() ?? false
  return (
    <span
      className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${on ? 'border-accent bg-accent text-accent-ink' : 'border-rule-strong'}`}
      aria-hidden="true"
    >
      <AnimatePresence>
        {on && (
          <motion.span initial={reduced ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: easeGentle }}>
            <Check size="0.875rem" strokeWidth={2} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

/**
 * Yes/no and category answers as large option cards (≥ 56px) with a mark that fills and checks, plus
 * "I'm not sure" (not recorded). Radiogroup: arrows move and select. Cards lift 2px on hover.
 */
export function OptionCards({ feature: f, value, onChange, labelledBy }: { feature: FeatureSpec; value: number | null; onChange: (v: number | null) => void; labelledBy: string }) {
  const t = useT()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const choices: { value: number | null; label: string }[] = [...(f.options ?? []), { value: null, label: t('assess.notSure') }]
  const index = choices.findIndex((c) => c.value === (value === null ? null : Math.round(value)))
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = (Math.max(0, index) + dir + choices.length) % choices.length
    onChange(choices[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} onKeyDown={onKeyDown} className="grid max-w-[36rem] grid-cols-1 gap-3">
      {choices.map((c, i) => {
        const on = i === index
        const unsure = c.value === null
        return (
          <button
            key={c.label}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on || (index < 0 && i === 0) ? 0 : -1}
            onClick={() => onChange(c.value)}
            className={`flex min-h-14 items-center gap-4 rounded-panel border px-5 py-3 text-left type-body-lg transition-[transform,box-shadow,border-color,background-color] duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] motion-reduce:hover:translate-y-0 ${
              on ? 'border-accent bg-accent-soft text-ink' : unsure ? 'border-dashed border-rule-strong bg-surface text-muted' : 'border-rule bg-surface text-ink'
            }`}
          >
            <Mark on={on} />
            {c.label}
          </button>
        )
      })}
    </div>
  )
}

/** Numbers: a large input with its unit, a friendly range hint while focused, and "I don't know this". */
export function NumberAnswer({ feature: f, value, onChange, onSubmit }: { feature: FeatureSpec; value: number | null; onChange: (v: number | null) => void; onSubmit: () => void }) {
  const t = useT()
  const id = useId()
  const fmt = (v: number | null) => (v === null ? '' : String(Number(v.toFixed(decimalsOf(f.step)))))
  const [text, setText] = useState(fmt(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    setText((current) => {
      const parsed = current.trim() === '' ? null : Number(current)
      return parsed === value ? current : fmt(value)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fmt only depends on the step
  }, [value, f.step])
  const bound = (v: number) => `${Number(v.toFixed(4))}${f.unit ? `\u00a0${f.unit}` : ''}`
  return (
    <div className="max-w-[36rem]">
      <label htmlFor={id} className="sr-only">
        {f.question}
      </label>
      <div className="relative w-full max-w-[20rem]">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          value={text}
          placeholder="—"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSubmit()
            }
          }}
          onChange={(e) => {
            const v = e.target.value
            setText(v)
            if (v.trim() === '') onChange(null)
            else if (!Number.isNaN(Number(v))) onChange(Number(v))
          }}
          aria-describedby={`${id}-hint`}
          className="h-16 w-full rounded-panel border border-rule-strong bg-surface px-5 pr-24 type-h2 text-ink outline-none transition-colors duration-300 placeholder:text-muted focus-visible:border-accent"
        />
        {f.unit && <span className="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2 type-body-lg text-muted">{f.unit}</span>}
      </div>
      <p id={`${id}-hint`} className={`mt-3 min-h-[1.6em] type-body text-muted transition-opacity duration-300 ${focused ? 'opacity-100' : 'opacity-0'}`}>
        {t('assess.range', { lo: bound(f.min), hi: bound(f.max) })}
      </p>
      <button
        type="button"
        onClick={() => {
          onChange(null)
          onSubmit()
        }}
        className="mt-2 type-body text-ink underline decoration-rule-strong underline-offset-4 transition-colors duration-300 hover:decoration-ink"
      >
        {t('assess.dontKnow')}
      </button>
    </div>
  )
}
