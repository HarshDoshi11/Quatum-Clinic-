import { useState } from 'react'
import { ChartTooltipCard } from '@/components/charts/ChartTooltip'
import { formatPercent } from '@/lib/format'
import { SAFETY_LABEL, safetyStatus } from '@/lib/safety'
import type { FailureEnvelopeSweep, SafetyStatus } from '@/types'

/** Risk colours, softened toward the background so labels and outlines stay readable (a blend, not a gradient). */
const FILL: Record<SafetyStatus, string> = {
  safe: 'color-mix(in srgb, var(--risk-low) 62%, var(--bg))',
  borderline: 'color-mix(in srgb, var(--risk-mid) 62%, var(--bg))',
  unsafe: 'color-mix(in srgb, var(--risk-high) 62%, var(--bg))',
}

interface HeatmapProps {
  sweep: FailureEnvelopeSweep
  threshold: number
}

/**
 * 2D view of the envelope: one cell per tested condition, coloured by the
 * shared safety rule. An ink outline traces where the point estimate crosses
 * the threshold. Rows run from 0% corruption (bottom) to 30% (top).
 */
export function Heatmap({ sweep, threshold }: HeatmapProps) {
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null)
  const xs = sweep.noiseAxis.values
  const zs = sweep.corruptionAxis.values
  const above = (j: number, i: number) => sweep.sensitivity[j]?.[i] !== undefined && sweep.sensitivity[j][i] >= threshold
  const hereI = xs.indexOf(sweep.current.noise)
  const hereJ = zs.indexOf(sweep.current.corruption)
  const rows = [...zs.keys()].reverse() // top row = highest corruption

  return (
    <div className="flex gap-3">
      {/* y-axis */}
      <div className="flex flex-col justify-between pb-8 text-right" aria-hidden="true">
        {rows.map((j) => (
          <span key={j} className="num flex h-full items-center justify-end type-small text-muted">
            {j % 2 === 0 ? `${zs[j]}%` : ''}
          </span>
        ))}
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="grid h-[24rem]" style={{ gridTemplateColumns: `repeat(${xs.length}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${zs.length}, minmax(0, 1fr))` }} onPointerLeave={() => setHover(null)}>
          {rows.map((j) =>
            xs.map((_, i) => {
              const s = sweep.sensitivity[j][i]
              const status = safetyStatus(s, sweep.sensitivityStd[j][i], threshold)
              // Threshold boundary: draw an edge wherever a neighbour is on the other side.
              const edges: string[] = []
              if (above(j, i) !== above(j, i + 1) && i + 1 < xs.length) edges.push('inset -2px 0 0 var(--ink)')
              if (above(j, i) !== above(j + 1, i) && j + 1 < zs.length) edges.push('inset 0 2px 0 var(--ink)')
              const here = i === hereI && j === hereJ
              return (
                <div
                  key={`${j}-${i}`}
                  onPointerEnter={() => setHover({ i, j })}
                  className="relative"
                  style={{ background: FILL[status], boxShadow: edges.join(', ') || undefined, outline: hover?.i === i && hover.j === j ? '1px solid var(--ink)' : undefined }}
                >
                  {here && <span className="absolute inset-[18%] rounded-full border-2 border-ink" aria-hidden="true" />}
                </div>
              )
            }),
          )}
        </div>
        {/* x-axis */}
        <div className="mt-2 grid" style={{ gridTemplateColumns: `repeat(${xs.length}, minmax(0, 1fr))` }} aria-hidden="true">
          {xs.map((x, i) => (
            <span key={i} className="num text-center type-small text-muted">
              {i % 2 === 0 ? `${x}%` : ''}
            </span>
          ))}
        </div>
        <p className="type-label mt-1 text-center text-muted">Two-qubit gate error →</p>

        {hover && (
          <div className="pointer-events-none absolute z-10" style={{ left: `${((hover.i + 0.5) / xs.length) * 100}%`, top: `${((zs.length - 1 - hover.j) / zs.length) * 24}rem`, transform: 'translate(-50%, -105%)' }}>
            <ChartTooltipCard
              title={`${xs[hover.i]}% gate error · ${zs[hover.j]}% corruption`}
              rows={[
                { key: 's', label: 'Sensitivity', value: `${formatPercent(sweep.sensitivity[hover.j][hover.i])} ±${(sweep.sensitivityStd[hover.j][hover.i] * 100).toFixed(1)}` },
                { key: 'c', label: 'Status', value: SAFETY_LABEL[safetyStatus(sweep.sensitivity[hover.j][hover.i], sweep.sensitivityStd[hover.j][hover.i], threshold)] },
              ]}
            />
          </div>
        )}
      </div>
      <p className="type-label self-center text-muted [writing-mode:vertical-rl] rotate-180" aria-hidden="true">
        Data corruption →
      </p>
    </div>
  )
}
