import type { ReactNode } from 'react'

export interface TooltipRow {
  key: string
  /** Swatch colour (series identity). Text stays in ink. */
  color?: string
  /** Dashed swatch for the second series of a family. */
  dashed?: boolean
  label: ReactNode
  value: ReactNode
}

interface ChartTooltipProps {
  title?: ReactNode
  rows: TooltipRow[]
}

/** Hairline tooltip card used by every chart's hover layer. */
export function ChartTooltipCard({ title, rows }: ChartTooltipProps) {
  return (
    <div className="shadow-float min-w-[12rem] rounded-[2px] bg-bg px-3 py-2.5">
      {title && <p className="type-label mb-2 text-muted">{title}</p>}
      <dl className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-6">
            <dt className="flex items-center gap-2 type-small text-ink">
              {r.color && (
                <svg width="14" height="8" aria-hidden="true" className="shrink-0">
                  <line x1="0" y1="4" x2="14" y2="4" stroke={r.color} strokeWidth="2" strokeDasharray={r.dashed ? '3 2' : undefined} />
                </svg>
              )}
              {r.label}
            </dt>
            <dd className="num type-small text-ink">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
