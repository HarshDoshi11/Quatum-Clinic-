import type { KeyboardEvent, ReactNode } from 'react'
import { Skeleton } from './Skeleton'

export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  align?: 'left' | 'right'
  /** CSS width, e.g. "12%" or "120px". */
  width?: string
  mono?: boolean
}

interface HairlineTableProps<T> {
  columns: readonly Column<T>[]
  rows: readonly T[] | undefined
  rowKey: (row: T) => string
  /** Rows become buttons (Enter / Space) when set. */
  onRowClick?: (row: T) => void
  rowLabel?: (row: T) => string
  loading?: boolean
  skeletonRows?: number
  empty?: ReactNode
  caption: string
}

/** Mono table with 1px hairline rows; no cards, no zebra stripes. */
export function HairlineTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  rowLabel,
  loading = false,
  skeletonRows = 5,
  empty,
  caption,
}: HairlineTableProps<T>) {
  const align = (c: Column<T>) => (c.align === 'right' ? 'text-right' : 'text-left')
  const onKey = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onRowClick?.(row)
    }
  }

  return (
    <table className="w-full border-collapse text-[13px]">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-rule-strong">
          {columns.map((c) => (
            <th
              key={c.key}
              scope="col"
              style={{ width: c.width }}
              className={`label-mono py-3 pr-4 font-normal text-muted last:pr-0 ${align(c)}`}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {loading || !rows
          ? Array.from({ length: skeletonRows }, (_, i) => (
              <tr key={i} className="border-b border-rule">
                {columns.map((c) => (
                  <td key={c.key} className={`py-3.5 pr-4 last:pr-0 ${align(c)}`}>
                    <Skeleton width={c.align === 'right' ? 5 : 9} />
                  </td>
                ))}
              </tr>
            ))
          : rows.length === 0
            ? (
                <tr>
                  <td colSpan={columns.length} className="border-b border-rule py-10 text-center text-muted">
                    {empty ?? 'Nothing here yet.'}
                  </td>
                </tr>
              )
            : rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => onKey(e, row) : undefined}
                  className={`border-b border-rule ${onRowClick ? 'cursor-pointer hover:bg-surface focus-visible:bg-surface' : ''}`}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`py-3.5 pr-4 last:pr-0 ${align(c)} ${c.mono ? 'num' : ''}`}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
      </tbody>
    </table>
  )
}
