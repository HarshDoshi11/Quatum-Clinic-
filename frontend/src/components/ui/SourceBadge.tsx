import type { DataSource } from '@/types'

/**
 * Where a page's numbers come from, from the response's `source` field: "REAL · 5 SEEDS" (cobalt) for the
 * real pipeline in ml/, "SIMULATED" (graphite) for the calibrated results store. Sits next to the page title.
 */
export function SourceBadge({ source }: { source: DataSource }) {
  const real = source.kind === 'real'
  return (
    <span
      className={`type-label inline-flex shrink-0 items-center rounded-[2px] border px-1.5 py-px whitespace-nowrap ${real ? 'border-accent text-accent' : 'border-rule-strong text-muted'}`}
      title={real ? `Real pipeline results, mean over ${source.seeds} seeds` : 'Simulated results from the calibrated results store'}
    >
      {real ? `Real · ${source.seeds} seeds` : 'Simulated'}
    </span>
  )
}
