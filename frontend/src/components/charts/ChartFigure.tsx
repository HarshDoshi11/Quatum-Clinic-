import { useId, useState, type ReactNode } from 'react'
import { Glossed } from '@/components/ui/Glossed'
import { HairlineTable, type Column } from '@/components/ui/HairlineTable'
import { SegmentedToggle, type SegmentOption } from '@/components/ui/SegmentedToggle'
import { Skeleton } from '@/components/ui/Skeleton'

export interface LegendItem {
  key: string
  label: ReactNode
  color: string
  dashed?: boolean
  shape?: 'line' | 'dot' | 'ring' | 'square'
}

type View = 'chart' | 'table'
const VIEW_OPTIONS: readonly SegmentOption<View>[] = [
  { value: 'chart', label: 'Chart' },
  { value: 'table', label: 'Table' },
]

interface ChartFigureProps<Row> {
  /** Mono label, e.g. "Fig. 02 — Learning curves". */
  label: string
  /** Mono evaluation setting under the label, e.g. "5 SEEDS · HELD-OUT 30% · WDBC". */
  subtitle?: string
  /** One-sentence takeaway shown above the chart (usually from the API). */
  takeaway: string | undefined
  /** Always-visible plain explanation of how to read the chart. */
  caption?: ReactNode
  /** Small mono note beside the legend, e.g. "AXIS ZOOMED · 0.94–0.98". */
  note?: ReactNode
  /** Right-aligned extra (e.g. an ExperimentTag). */
  aside?: ReactNode
  legend?: LegendItem[]
  /** Chart height (CSS length). */
  height?: string
  loading?: boolean
  /** Accessible table view of the same data. */
  table?: { columns: Column<Row>[]; rows: readonly Row[] | undefined; rowKey: (row: Row) => string; caption: string }
  children: ReactNode
}

function Swatch({ item }: { item: LegendItem }) {
  if (item.shape === 'dot') return <span className="block h-2.5 w-2.5 rounded-full" style={{ background: item.color }} aria-hidden="true" />
  if (item.shape === 'ring') return <span className="block h-2.5 w-2.5 rounded-full border-[1.5px]" style={{ borderColor: item.color }} aria-hidden="true" />
  if (item.shape === 'square') return <span className="block h-2.5 w-2.5" style={{ background: item.color }} aria-hidden="true" />
  return (
    <svg width="20" height="8" aria-hidden="true">
      <line x1="0" y1="4" x2="20" y2="4" stroke={item.color} strokeWidth="2" strokeDasharray={item.dashed ? '4 3' : undefined} />
    </svg>
  )
}

/**
 * Figure shell for every chart: label, takeaway above the plot, legend,
 * and a Chart / Table toggle so the data is never colour- or vision-only.
 */
export function ChartFigure<Row>({ label, subtitle, takeaway, caption, note, aside, legend, height = '22rem', loading, table, children }: ChartFigureProps<Row>) {
  const [view, setView] = useState<View>('chart')
  const id = useId()

  return (
    <figure aria-labelledby={`${id}-label`} className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p id={`${id}-label`} className="type-label text-ink">
            {label}
          </p>
          {subtitle && <p className="type-label mt-1 text-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {aside}
          {table && <SegmentedToggle<View> options={VIEW_OPTIONS} value={view} onChange={setView} layoutId={`${id}-view`} ariaLabel={`${label}: view`} size="sm" />}
        </div>
      </div>

      <p className="measure mt-3 type-body-lg text-ink">
        {takeaway ? <Glossed text={takeaway} /> : <Skeleton width="60%" height="1.2em" />}
      </p>
      {caption && <p className="measure mt-2 type-small text-muted">{caption}</p>}

      {((legend && legend.length > 0) || note) && view === 'chart' && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Legend">
            {legend?.map((item) => (
              <li key={item.key} className="flex items-center gap-2 type-small text-ink">
                <Swatch item={item} />
                {item.label}
              </li>
            ))}
          </ul>
          {note && <p className="type-label text-muted">{note}</p>}
        </div>
      )}

      <div className="mt-5">
        {view === 'table' && table ? (
          <div className="overflow-x-auto">
            <HairlineTable columns={table.columns} rows={table.rows} rowKey={table.rowKey} caption={table.caption} loading={loading} />
          </div>
        ) : loading ? (
          <div style={{ height: height === 'auto' ? '22rem' : height }} className="flex items-end gap-2 border-b border-l border-rule px-4 pb-4" aria-busy="true">
            {[38, 52, 61, 70, 76, 80, 82].map((h, i) => (
              <span key={i} className="flex-1 bg-rule motion-safe:animate-pulse" style={{ height: `${h}%` }} aria-hidden="true" />
            ))}
          </div>
        ) : (
          <div style={{ height }} className="w-full">
            {children}
          </div>
        )}
      </div>
    </figure>
  )
}
