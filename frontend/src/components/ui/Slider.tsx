import { useId, type CSSProperties, type ReactNode } from 'react'

interface SliderProps {
  label: ReactNode
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  /** Value shown right-aligned in mono. */
  format?: (value: number) => string
  /** Screen-reader value text, e.g. "34 percent". Defaults to format(value). */
  valueText?: (value: number) => string
  /** Accent for quantum parameters; ink otherwise. */
  tone?: 'ink' | 'accent'
  hint?: ReactNode
  disabled?: boolean
}

/** Native range input restyled: 1px track, filled portion, small square thumb, mono readout. */
export function Slider({ label, value, min, max, step, onChange, format = String, valueText, tone = 'ink', hint, disabled }: SliderProps) {
  const id = useId()
  const fill = ((value - min) / (max - min)) * 100
  return (
    // Disabled dims only the track: text keeps full contrast (readability rule).
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="type-label text-muted">
          {label}
        </label>
        <output htmlFor={id} className="num type-small text-ink">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={(valueText ?? format)(value)}
        data-tone={tone}
        className="qc-range mt-1.5 disabled:cursor-not-allowed disabled:opacity-40"
        style={{ '--fill': `${fill}%` } as CSSProperties}
      />
      {hint && <div className="mt-1 type-small text-muted">{hint}</div>}
    </div>
  )
}
