import { useEffect, useId, useState, type ReactNode } from 'react'
import type { FeatureSpec } from '@/types'
import { Select, type SelectOption } from './Select'

/** Decimals implied by a step: 0.01 → 2, 1 → 0. */
export const decimalsOf = (step: number): number => (step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step))))

/** A feature value as a person reads it: option label, or number with unit. */
export function formatFeatureValue(f: Pick<FeatureSpec, 'options' | 'unit' | 'step'>, v: number | null): string {
  if (v === null) return 'missing'
  const option = f.options?.find((o) => o.value === Math.round(v))
  if (option) return option.label
  return `${v.toFixed(decimalsOf(f.step))}${f.unit ? `\u00a0${f.unit}` : ''}`
}

const INPUT =
  'num w-full border-0 border-b bg-transparent py-1.5 type-ui text-ink outline-none transition-colors focus-visible:border-accent'

interface FeatureFieldProps {
  feature: FeatureSpec
  value: number | null
  onChange: (value: number | null) => void
}

/**
 * One patient input: underlined. The valid training range appears only while the field has focus, or when the
 * value is outside it; it overlays the gap below, so showing it never moves the form.
 * Empty = missing. Values outside the range are allowed (the model will abstain) but flagged.
 */
export function FeatureField({ feature: f, value, onChange }: FeatureFieldProps) {
  const id = useId()
  const [focused, setFocused] = useState(false)
  const outside = value !== null && (value < f.min || value > f.max)
  // Bounds at full precision (area's minimum is 143.5 even though it steps by 1), as the abstain reasons print them.
  const bound = (v: number) => `${Number(v.toFixed(4))}${f.unit ? `\u00a0${f.unit}` : ''}`
  const range = f.options ? null : `${bound(f.min)} – ${bound(f.max)}`
  const line = outside ? 'border-ink' : 'border-rule-strong'

  let control: ReactNode
  if (f.options) {
    // "Not recorded" is a real choice (the value is missing), listed last and muted.
    const options: SelectOption<string>[] = [...f.options.map((o) => ({ value: String(o.value), label: o.label })), { value: '', label: 'Not recorded', muted: true }]
    control = (
      <div className="mt-1">
        <Select
          id={id}
          value={value === null ? '' : String(Math.round(value))}
          options={options}
          onChange={(v) => onChange(v === '' ? null : Number(v))}
          emphasis={outside}
        />
      </div>
    )
  } else {
    control = <NumberInput id={id} value={value} step={f.step} onChange={onChange} className={`${INPUT} ${line}`} unit={f.unit} />
  }

  const hint = outside ? (
    <>
      <span className="type-label">Outside training range</span> · {range}
    </>
  ) : focused && range ? (
    <>Range {range}</>
  ) : null

  return (
    <div className="relative" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
      <label htmlFor={id} className="type-label text-muted">
        {f.label}
      </label>
      {control}
      <p className={`num absolute top-full left-0 mt-0.5 whitespace-nowrap type-small ${outside ? 'text-ink' : 'text-muted'}`} aria-live="polite">
        {hint}
      </p>
    </div>
  )
}

interface NumberInputProps {
  id: string
  value: number | null
  step: number
  unit: string | null
  onChange: (value: number | null) => void
  className: string
}

/** Keeps the typed text while it is being edited ("1.", "") and syncs when the value changes elsewhere. */
function NumberInput({ id, value, step, unit, onChange, className }: NumberInputProps) {
  const fmt = (v: number | null) => (v === null ? '' : String(Number(v.toFixed(decimalsOf(step)))))
  const [text, setText] = useState(fmt(value))
  useEffect(() => {
    setText((t) => {
      const parsed = t.trim() === '' ? null : Number(t)
      return parsed === value ? t : fmt(value)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fmt only depends on step
  }, [value, step])
  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        placeholder="—"
        onChange={(e) => {
          const t = e.target.value
          setText(t)
          if (t.trim() === '') onChange(null)
          else if (!Number.isNaN(Number(t))) onChange(Number(t))
        }}
        className={`${className} ${unit ? 'pr-14' : ''}`}
      />
      {unit && <span className="num pointer-events-none absolute right-0 bottom-2 type-small text-muted">{unit}</span>}
    </div>
  )
}
