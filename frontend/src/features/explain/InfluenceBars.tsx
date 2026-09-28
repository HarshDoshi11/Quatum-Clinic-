import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type PointerEvent } from 'react'
import { ViewMenu, type View } from '@/components/charts/ViewMenu'
import { Glossed } from '@/components/ui/Glossed'
import { HairlineTable, type Column } from '@/components/ui/HairlineTable'
import { formatDelta, formatPercent } from '@/lib/format'
import { springBar } from '@/lib/motion'
import { niceScale, useChartUnits } from '@/components/charts/chartTheme'
import type { FeatureContribution } from '@/types'

export type InfluenceRow = FeatureContribution & { display: string }

/** Rows shown before "Show all". */
const TOP = 6
/** Below this (fraction), a bar counts as unchanged: no ghost. */
const GHOST_MIN = 0.0005

const pts = (fraction: number) => `${formatDelta(fraction * 100, 1)} pts`
const tick = (v: number) => (v === 0 ? '0' : formatDelta(v, 0))
/** Keep an edge tick label inside the plot. */
const tickShift = (f: number) => (f < 0.04 ? '0%' : f > 0.96 ? '-100%' : '-50%')

interface InfluenceBarsProps {
  rows: InfluenceRow[]
  /** Effect of each input for the unchanged patient (feature → fraction), drawn as a ghost when a bar moves. */
  original: Map<string, number>
  takeaway: string | undefined
  evaluation: string | undefined
  baseProbability: number | undefined
}

/**
 * Horizontal influence bars in percentage points of risk, largest first. Bars spring to new
 * lengths and re-sort smoothly as what-ifs change; a faint ghost keeps the original length.
 * The axis fits the data (it may be asymmetric). Hover or focus shows a one-line card inside
 * the row itself, so it can never cover another bar's value.
 */
export function InfluenceBars({ rows, original, takeaway, evaluation, baseProbability }: InfluenceBarsProps) {
  const reduced = useReducedMotion() ?? false
  const { rem } = useChartUnits()
  const [view, setView] = useState<View>('chart')
  const [showAll, setShowAll] = useState(false)
  const [hover, setHover] = useState<{ feature: string; x: number; width: number } | null>(null)

  const sorted = [...rows].sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
  const shown = showAll ? sorted : sorted.slice(0, TOP)
  const values = shown.flatMap((r) => [r.effect, original.get(r.feature) ?? r.effect]).map((v) => v * 100)
  const { domain, ticks } = niceScale(Math.min(0, ...values), Math.max(0, ...values), 4)
  const [d0, d1] = domain
  const at = (v: number) => (v * 100 - d0) / (d1 - d0 || 1)
  const span = (v: number) => ({ left: `${Math.min(at(0), at(v)) * 100}%`, width: `${Math.abs(at(v) - at(0)) * 100}%` })

  const onMove = (feature: string) => (e: PointerEvent<HTMLLIElement>) => {
    if (e.pointerType === 'touch') return
    const rect = e.currentTarget.getBoundingClientRect()
    setHover({ feature, x: e.clientX - rect.left, width: rect.width })
  }

  const columns: Column<InfluenceRow>[] = [
    { key: 'f', header: 'Input', render: (r) => `${r.label}${r.locked ? ' · locked' : ''}` },
    { key: 'v', header: 'Value used', mono: true, render: (r) => `${r.display}${r.adjustment ? ` (${r.adjustment})` : ''}` },
    { key: 'e', header: 'Effect', align: 'right', mono: true, render: (r) => pts(r.effect) },
    { key: 'c', header: 'Log-odds', align: 'right', mono: true, render: (r) => formatDelta(r.contribution, 2) },
  ]

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="type-small text-ink">{takeaway ? <Glossed text={takeaway} /> : ' '}</p>
          {evaluation && <p className="type-label mt-1 text-muted">{evaluation}</p>}
        </div>
        <ViewMenu view={view} onChange={setView} label="Influence chart options" />
      </div>

      {view === 'table' ? (
        <div className="mt-4 overflow-x-auto">
          <HairlineTable columns={columns} rows={sorted} rowKey={(r) => r.feature} caption="Influence of each input: percentage points of risk and log-odds" />
        </div>
      ) : (
        <>
          <ul className="mt-4" aria-label="Influence of each input on the estimate">
            <AnimatePresence initial={false} mode="popLayout">
              {shown.map((r) => {
                const was = original.get(r.feature)
                const moved = was !== undefined && Math.abs(was - r.effect) > GHOST_MIN
                const colour = r.effect >= 0 ? 'bg-risk-high' : 'bg-risk-low'
                const card = `${r.display}${r.adjustment ? ` (${r.adjustment})` : ''} · log-odds ${formatDelta(r.contribution, 2)}`
                const cardW = card.length * rem * 0.45 + rem * 1.25
                const h = hover?.feature === r.feature ? hover : null
                // The card stays left of the value column (it never covers a value), flipping to the pointer's left near
                // the edge and clamped at the row start.
                const limit = h ? h.width - rem * 4.75 - rem * 0.75 : 0
                const cardLeft = h ? (h.x + 12 + cardW <= limit ? h.x + 12 : Math.max(0, Math.min(h.x - 12, limit) - cardW)) : 0
                return (
                  <motion.li
                    key={r.feature}
                    layout={reduced ? false : 'position'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={springBar}
                    tabIndex={0}
                    onPointerMove={onMove(r.feature)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={(e) => setHover({ feature: r.feature, x: e.currentTarget.getBoundingClientRect().width * 0.3, width: e.currentTarget.getBoundingClientRect().width })}
                    onBlur={() => setHover(null)}
                    aria-label={`${r.label}${r.locked ? ', locked' : ''}: ${r.effect >= 0 ? 'raises' : 'lowers'} risk by ${formatDelta(Math.abs(r.effect) * 100, 1).slice(1)} points (${card})`}
                    className="relative grid h-8 grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_4.75rem] items-center gap-3 outline-none focus-visible:bg-ink/[0.04]"
                  >
                    <span className="truncate type-small text-ink">
                      {r.label}
                      {r.locked && <span className="text-muted"> · locked</span>}
                    </span>
                    <span className="relative block h-full" aria-hidden="true">
                      <span className="absolute inset-y-0 w-px bg-ink" style={{ left: `${at(0) * 100}%` }} />
                      <AnimatePresence>
                        {moved && (
                          <motion.span
                            className={`absolute top-1/2 h-3.5 -translate-y-1/2 ${(was ?? 0) >= 0 ? 'bg-risk-high' : 'bg-risk-low'}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.3 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={span(was ?? 0)}
                          />
                        )}
                      </AnimatePresence>
                      <motion.span
                        className={`absolute top-1/2 h-3.5 -translate-y-1/2 ${colour}`}
                        initial={false}
                        animate={span(r.effect)}
                        transition={reduced ? { duration: 0 } : springBar}
                      />
                      {/* A ghost shorter than the new bar hides behind it: its end stays visible as a thin mark */}
                      {moved && was !== undefined && Math.sign(was) === Math.sign(r.effect) && Math.abs(was) < Math.abs(r.effect) && (
                        <span className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-bg opacity-70" style={{ left: `${at(was) * 100}%` }} />
                      )}
                    </span>
                    <span className="num text-right type-small text-ink">{pts(r.effect)}</span>
                    {h && (
                      <span
                        className="pointer-events-none absolute top-1/2 z-10 flex h-6 -translate-y-1/2 items-center rounded-[2px] bg-ink px-2 whitespace-nowrap type-small text-bg"
                        style={{ left: cardLeft }}
                        aria-hidden="true"
                      >
                        {card}
                      </span>
                    )}
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>

          {/* Axis: ticks under the bar column, unit in the value column */}
          <div className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_4.75rem] gap-3 border-t border-rule pt-1" aria-hidden="true">
            <span />
            <span className="relative block h-5">
              {ticks.map((t) => {
                const f = (t - d0) / (d1 - d0 || 1)
                return (
                  <span key={t} className="num type-label absolute top-0 text-muted" style={{ left: `${f * 100}%`, translate: tickShift(f) }}>
                    {tick(t)}
                  </span>
                )
              })}
            </span>
            <span className="type-label text-right text-muted">pts</span>
          </div>

          <div className="mt-2 flex items-baseline justify-between gap-4">
            {rows.length > TOP ? (
              <button type="button" onClick={() => setShowAll((v) => !v)} className="type-label text-ink underline-offset-4 transition-colors duration-150 hover:underline">
                {showAll ? `Show top ${TOP}` : `Show all ${rows.length}`}
              </button>
            ) : (
              <span />
            )}
            {baseProbability !== undefined && (
              <span className="type-small text-muted">
                0 = an average patient (<span className="num">{formatPercent(baseProbability)}</span>)
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
