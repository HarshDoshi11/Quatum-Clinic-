import { TriangleAlert } from 'lucide-react'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { HairlineTable, type Column } from '@/components/ui/HairlineTable'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatPercent, formatPoints } from '@/lib/format'
import { tQuick } from '@/lib/motion'
import { safetyStatus } from '@/lib/safety'
import { useElementSize } from '@/lib/useElementSize'
import { PROJECTOR_COMPACT_VIEWPORT, SHORT_VIEWPORT, useMediaQuery } from '@/lib/useMediaQuery'
import { useProjector } from '@/state/projector'
import type { ThresholdPoint } from '@/types'
import { C, TICK, useChartUnits } from './chartTheme'
import { resolveLabelOffsets } from './directLabels'
import { ViewMenu, type View } from './ViewMenu'

const X_TICKS = [0, 0.25, 0.5, 0.75, 1]
/** Dragging within this distance of the default or a safe-range edge lands on it. */
const SNAP = 0.015
/** Light spring for the handle, dots and readout. */
const HANDLE_SPRING = { stiffness: 300, damping: 30 }

const pct = (x: number) => `${Math.round(x * 100)}%`
const round2 = (v: number) => Math.round(v * 100) / 100

/** "misses more than half of sick patients" / "misses about 22 in 100 sick patients" — computed from the sensitivity. */
export const missWording = (sensitivity: number) =>
  sensitivity < 0.5 ? 'misses more than half of sick patients' : `misses about ${Math.round((1 - sensitivity) * 100)} in 100 sick patients`

/** Linear interpolation of a curve field at threshold v (the curve is in 0.01 steps). */
function at(curve: ThresholdPoint[], key: 'sensitivity' | 'specificity', v: number): number {
  const i = curve.findIndex((p) => p.threshold >= v)
  if (i <= 0) return curve[Math.max(0, i)]?.[key] ?? 0
  const a = curve[i - 1]
  const b = curve[i]
  const f = (v - a.threshold) / (b.threshold - a.threshold || 1)
  return a[key] + (b[key] - a[key]) * f
}

/** The thresholds where mean sensitivity reaches the safety line, as [first, last] inside [min, max]. */
function safeRange(curve: ThresholdPoint[], safe: number, min: number, max: number): [number, number] | null {
  const ok = curve.filter((p) => p.threshold >= min - 1e-9 && p.threshold <= max + 1e-9 && p.sensitivity >= safe)
  return ok.length ? [ok[0].threshold, ok[ok.length - 1].threshold] : null
}

interface ThresholdScrubberProps {
  label: ReactNode
  curve: ThresholdPoint[]
  value: number
  defaultValue: number
  safeSensitivity: number
  min: number
  max: number
  /** Called live while dragging, with the threshold rounded to 1%. */
  onChange: (value: number) => void
  onReset: () => void
}

/**
 * Sensitivity and specificity across decision thresholds, and the control that picks one:
 * drag or click anywhere on the chart, or use the keyboard. Every label has its own lane,
 * so nothing collides: the readout chip above the plot, the safe-range label in a band at
 * the top of the shaded zone, the safety label in the left gutter, end labels in the right
 * gutter, and the default as a triangle under the axis (labelled on hover). The safe range
 * is where mean sensitivity reaches the safety line; the status under the chart uses the
 * shared noise-aware safety rule. Sizes are rem-based, so projector mode scales it.
 */
export function ThresholdScrubber({ label, curve, value, defaultValue, safeSensitivity, min, max, onChange, onReset }: ThresholdScrubberProps) {
  const id = useId()
  const reduced = useReducedMotion() ?? false
  const units = useChartUnits()
  const [view, setView] = useState<View>('chart')
  const [boxRef, { width }] = useElementSize<HTMLDivElement>()
  const short = useMediaQuery(SHORT_VIEWPORT)
  const projectorCompact = useMediaQuery(PROJECTOR_COMPACT_VIEWPORT)
  const { projector } = useProjector()

  // ── Geometry (px, from rem so projector mode scales it); shorter on short viewports
  const rem = units.rem
  const height = rem * (projector && projectorCompact ? 7.5 : short ? 9 : 10.5)
  const chipLane = rem * 1.625
  const band = rem * 1.25
  const axis = rem * 1.875
  const left = rem * 6
  const right = rem * 6.25
  const plotTop = chipLane + band
  const plotW = Math.max(1, width - left - right)
  const plotH = height - plotTop - axis
  const x = (v: number) => left + v * plotW
  const y = (v: number) => plotTop + (1 - v) * plotH
  const bottom = y(0)
  const invert = (px: number) => Math.min(max, Math.max(min, (px - left) / plotW))
  const labelChar = rem * 0.8125 * 0.66
  const textWidth = (text: string) => text.length * labelChar

  const inRange = curve.filter((p) => p.threshold >= min - 1e-9 && p.threshold <= max + 1e-9)
  const range = safeRange(curve, safeSensitivity, min, max)
  const point = curve.find((p) => p.threshold === value)
  const status = point ? safetyStatus(point.sensitivity, point.sensitivityStd, safeSensitivity) : 'safe'
  const unsafe = status === 'unsafe'
  const isDefault = value === defaultValue
  const readout = (v: number) => `Sens ${formatPercent(at(curve, 'sensitivity', v))} · Spec ${formatPercent(at(curve, 'specificity', v))}`

  // ── Spring-driven handle: the dots and the chip ride the same value
  const spring = useSpring(value, HANDLE_SPRING)
  useEffect(() => {
    if (reduced) spring.jump(value)
    else spring.set(value)
  }, [value, reduced, spring])
  const hx = useTransform(spring, (v) => left + v * plotW)
  const sensY = useTransform(spring, (v) => plotTop + (1 - at(curve, 'sensitivity', v)) * plotH)
  const specY = useTransform(spring, (v) => plotTop + (1 - at(curve, 'specificity', v)) * plotH)
  const grip = rem * 0.5
  const gripX = useTransform(hx, (px) => px - grip / 2)
  // The chip is centred on the handle and clamped inside the chart, so it never clips at the ends.
  const chipW = (text: string) => textWidth(text) + rem * 0.75 + 2
  const chipClamp = (px: number, w: number) => Math.min(Math.max(px - w / 2, 0), Math.max(0, width - w))
  // Motion values, so the spring-driven transform always sees the current chip and chart widths.
  const chipWidth = useMotionValue(0)
  const chartWidth = useMotionValue(width)
  useEffect(() => {
    chipWidth.set(chipW(readout(value)))
    chartWidth.set(width)
  })
  const chipLeft = useTransform([hx, chipWidth, chartWidth], ([px, w, total]: number[]) => Math.min(Math.max(px - w / 2, 0), Math.max(0, total - w)))

  // ── Pointer: drag anywhere, click jumps, hover previews
  const [dragging, setDragging] = useState(false)
  const [ghost, setGhost] = useState<number | null>(null)
  const [pulse, setPulse] = useState<{ key: number; at: number } | null>(null)
  const snapped = useRef<number | null>(null)
  const snapTargets = [defaultValue, ...(range ?? [])].filter((t) => t > min + 1e-9 && t < max - 1e-9)

  const fromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return round2(invert(e.clientX - rect.left))
  }
  const commit = (raw: number) => {
    const target = snapTargets.find((t) => Math.abs(raw - t) <= SNAP)
    if (target !== undefined && snapped.current !== target && !reduced) setPulse({ key: Date.now(), at: target })
    snapped.current = target ?? null
    const next = target ?? raw
    if (next !== value) onChange(next)
  }
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    setGhost(null)
    commit(fromPointer(e))
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging) commit(fromPointer(e))
    else if (e.pointerType !== 'touch') setGhost(fromPointer(e))
  }
  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
    snapped.current = null
  }

  // ── Keyboard: ←/→ 1%, Shift 5%, Home/End to the range edges, Enter/Space resets
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.05 : 0.01
    let next: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = value + step
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = value - step
    else if (e.key === 'Home') next = min
    else if (e.key === 'End') next = max
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onReset()
      return
    }
    if (next === null) return
    e.preventDefault()
    onChange(round2(Math.min(max, Math.max(min, next))))
  }

  // ── Leaving the safe zone pulses it once
  const [zonePulse, setZonePulse] = useState(0)
  const wasUnsafe = useRef(unsafe)
  useEffect(() => {
    if (unsafe && !wasUnsafe.current && !reduced) setZonePulse((k) => k + 1)
    wasUnsafe.current = unsafe
  }, [unsafe, reduced])

  // ── Paths
  const line = (key: 'sensitivity' | 'specificity') => inRange.map((p, i) => `${i ? 'L' : 'M'}${x(p.threshold)},${y(p[key])}`).join('')
  const bandPath = (key: 'sensitivity' | 'specificity', std: 'sensitivityStd' | 'specificityStd') => {
    const upper = inRange.map((p) => `${x(p.threshold)},${y(Math.min(1, p[key] + p[std]))}`)
    const lower = [...inRange].reverse().map((p) => `${x(p.threshold)},${y(Math.max(0, p[key] - p[std]))}`)
    return `M${upper.join('L')}L${lower.join('L')}Z`
  }

  // ── Gutter labels, pushed apart where they would touch
  const end = inRange[inRange.length - 1]
  const rightOffsets = end
    ? resolveLabelOffsets(
        [
          { key: 'sens', value: end.sensitivity },
          { key: 'spec', value: end.specificity },
        ],
        [0, 1],
        plotH,
        units.labelGap,
      )
    : {}
  // The left labels may rise into the band above the plot (the domain is stretched by the band's height), so
  // "100%" and the safety label never stack when the chart is short.
  const leftOffsets = resolveLabelOffsets(
    [
      { key: '1', value: 1 },
      { key: 'safe', value: safeSensitivity },
      { key: '0.5', value: 0.5 },
    ],
    [0, 1 + band / plotH],
    plotH + band,
    units.labelGap,
  )
  const ly = (offsets: Record<string, number>, key: string, v: number) => y(v) + (offsets[key] ?? 0)

  // The safe-range label sits in the band at the top-left of the zone; a narrow zone gets the short form.
  const zoneW = range ? x(range[1]) - x(range[0]) : 0
  const rangeText = range ? `${Math.round(range[0] * 100)}–${pct(range[1])}` : ''
  const zoneLabel = textWidth(`Safe range ${rangeText}`) + rem * 0.75 <= zoneW ? `Safe range ${rangeText}` : `Safe ${rangeText}`

  const showGhost = ghost !== null && ghost !== value && !dragging
  const ghostText = showGhost ? `${pct(ghost)} → ${readout(ghost)}` : ''
  const valueText = point
    ? `${pct(value)}: sensitivity ${formatPercent(point.sensitivity)}, specificity ${formatPercent(point.specificity)}${unsafe ? ', unsafe' : ''}`
    : pct(value)

  const tableColumns: Column<ThresholdPoint>[] = [
    {
      key: 't',
      header: 'Threshold',
      mono: true,
      render: (p) => `${pct(p.threshold)}${p.threshold === defaultValue ? ' · default' : ''}${p.threshold === value ? ' · current' : ''}`,
    },
    { key: 's', header: 'Sensitivity', align: 'right', mono: true, render: (p) => `${formatPercent(p.sensitivity)} ±${formatPoints(p.sensitivityStd)}` },
    { key: 'p', header: 'Specificity', align: 'right', mono: true, render: (p) => `${formatPercent(p.specificity)} ±${formatPoints(p.specificityStd)}` },
  ]
  // The table opens scrolled to the current threshold's row.
  const tableRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (view !== 'table' || !tableRef.current) return
    const row = [...tableRef.current.querySelectorAll('tbody tr')].find((tr) => tr.textContent?.includes('current'))
    if (row instanceof HTMLElement) tableRef.current.scrollTop = row.offsetTop - rem * 2.75
  }, [view, rem])
  const tableRows = inRange.filter((p) => Math.round(p.threshold * 100) % 5 === 0 || p.threshold === defaultValue || p.threshold === value)

  const tone = unsafe ? C.riskHigh : C.ink

  return (
    <div ref={boxRef}>
      <div className="flex h-6 items-center justify-between gap-3">
        <p id={`${id}-label`} className="flex items-baseline gap-2">
          <span className="type-label text-muted">{label}</span>
          <span className={`num type-label ${unsafe ? 'text-risk-high-text' : 'text-ink'}`}>{pct(value)}</span>
        </p>
        <div className="flex items-center gap-3">
          {!isDefault && (
            <button
              type="button"
              onClick={onReset}
              title={`Back to the default, ${pct(defaultValue)}: the benchmark operating point`}
              className="type-label text-ink underline-offset-4 hover:underline"
            >
              Reset to default
            </button>
          )}
          <ViewMenu view={view} onChange={setView} label="Threshold chart options" />
        </div>
      </div>

      {view === 'table' ? (
        <div
          ref={tableRef}
          className="relative mt-1 overflow-y-auto"
          style={{ height }}
          tabIndex={0}
          aria-label="Sensitivity and specificity by threshold, scrollable"
        >
          <HairlineTable columns={tableColumns} rows={tableRows} rowKey={(p) => String(p.threshold)} caption="Sensitivity and specificity by threshold" />
        </div>
      ) : (
        <div
          role="slider"
          tabIndex={0}
          aria-labelledby={`${id}-label`}
          aria-valuemin={Math.round(min * 100)}
          aria-valuemax={Math.round(max * 100)}
          aria-valuenow={Math.round(value * 100)}
          aria-valuetext={valueText}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={() => setGhost(null)}
          className={`relative mt-1 touch-pan-y select-none outline-none focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent ${dragging ? 'cursor-grabbing' : 'cursor-ew-resize'}`}
          style={{ height }}
        >
          {width > 0 && (
            <svg width={width} height={height} className="block overflow-visible" aria-hidden="true">
              {/* Safe range: shaded from the label band down to the axis */}
              {range && (
                <>
                  <rect x={x(range[0])} y={chipLane} width={zoneW} height={bottom - chipLane} fill={C.riskLow} fillOpacity={0.13} />
                  {zonePulse > 0 && (
                    <motion.rect
                      key={zonePulse}
                      x={x(range[0])}
                      y={chipLane}
                      width={zoneW}
                      height={bottom - chipLane}
                      fill={C.riskLow}
                      initial={{ fillOpacity: 0.4 }}
                      animate={{ fillOpacity: 0 }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  )}
                  <text x={x(range[0]) + rem * 0.375} y={chipLane + band / 2} dy="0.35em" {...TICK} fill={C.ink} letterSpacing="0.06em">
                    {zoneLabel.toUpperCase()}
                  </text>
                </>
              )}

              {/* Left gutter: 100% and 50% hairline labels, and the safety line's label at its left end */}
              {[1, 0.5].map((v) => (
                <g key={v}>
                  <line x1={x(0)} x2={x(1)} y1={y(v)} y2={y(v)} stroke={C.rule} />
                  <text x={left - rem * 0.5} y={ly(leftOffsets, String(v), v)} dy="0.35em" textAnchor="end" {...TICK}>
                    {pct(v)}
                  </text>
                </g>
              ))}
              <line x1={x(0)} x2={x(1)} y1={y(safeSensitivity)} y2={y(safeSensitivity)} stroke={C.riskHigh} strokeDasharray="4 4" />
              <text
                x={left - rem * 0.5}
                y={ly(leftOffsets, 'safe', safeSensitivity)}
                dy="0.35em"
                textAnchor="end"
                {...TICK}
                fill="var(--risk-high-text)"
                letterSpacing="0.06em"
              >
                {`${pct(safeSensitivity)} SAFETY`}
              </text>

              {/* Axis: baseline and round ticks */}
              <line x1={x(0)} x2={x(1)} y1={bottom} y2={bottom} stroke={C.ruleStrong} />
              {X_TICKS.map((t) => (
                <g key={t}>
                  <line x1={x(t)} x2={x(t)} y1={bottom} y2={bottom + rem * 0.25} stroke={C.ruleStrong} />
                  <text x={x(t)} y={bottom + rem * 1.45} textAnchor="middle" {...TICK}>
                    {Math.round(t * 100)}
                  </text>
                </g>
              ))}

              {/* ±1 std bands (neutral), then the curves: sensitivity is the safety metric, so it is the stronger line */}
              <path d={bandPath('specificity', 'specificityStd')} fill={C.ink} fillOpacity={0.07} />
              <path d={bandPath('sensitivity', 'sensitivityStd')} fill={C.ink} fillOpacity={0.07} />
              <path d={line('specificity')} fill="none" stroke={C.muted} strokeWidth={1.5} className="chart-line" />
              <path d={line('sensitivity')} fill="none" stroke={C.accent} strokeWidth={2} className="chart-line chart-line-strong" />

              {/* Right gutter: end labels */}
              {end && (
                <g {...TICK} fill={C.ink}>
                  <text x={x(1) + rem * 0.5} y={ly(rightOffsets, 'sens', end.sensitivity)} dy="0.35em">
                    Sensitivity
                  </text>
                  <text x={x(1) + rem * 0.5} y={ly(rightOffsets, 'spec', end.specificity)} dy="0.35em">
                    Specificity
                  </text>
                </g>
              )}

              {/* Hover preview */}
              {showGhost && <line x1={x(ghost)} x2={x(ghost)} y1={chipLane} y2={bottom} stroke={C.ruleStrong} strokeDasharray="3 3" />}

              {/* Handle: line from the chip lane to the axis, grip, and the dots riding both curves */}
              <motion.line x1={hx} x2={hx} y1={chipLane} y2={bottom} stroke={tone} strokeWidth={1.5} style={{ transition: 'stroke 200ms' }} />
              {pulse && (
                <motion.circle
                  key={pulse.key}
                  cx={x(pulse.at)}
                  cy={bottom}
                  fill="none"
                  stroke={C.ink}
                  strokeWidth={1}
                  initial={{ r: rem * 0.25, opacity: 0.8 }}
                  animate={{ r: rem * 0.9, opacity: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              )}
              <motion.rect
                x={gripX}
                y={bottom - grip / 2}
                width={grip}
                height={grip}
                rx={1}
                fill={tone}
                stroke={C.bg}
                strokeWidth={1}
                style={{ transition: 'fill 200ms' }}
              />
              <motion.circle cx={hx} cy={specY} r={4} fill={C.bg} stroke={C.muted} strokeWidth={2} />
              <motion.circle cx={hx} cy={sensY} r={4} fill={C.bg} stroke={C.accent} strokeWidth={2} />
            </svg>
          )}

          {/* Default: a triangle under the axis, labelled on hover */}
          {width > 0 && (
            <Tooltip
              label={`Default ${pct(defaultValue)}`}
              content="The benchmark operating point: the threshold behind the sensitivity shown on every other page."
              width={260}
            >
              <span className="absolute block -translate-x-1/2 px-1" style={{ left: x(defaultValue), top: bottom + 2 }}>
                <svg width="10" height="7" viewBox="0 0 10 7" className="block h-[0.4375rem] w-[0.625rem]" aria-hidden="true">
                  <path d="M5 0 L10 7 H0 Z" fill={C.ink} />
                </svg>
              </span>
            </Tooltip>
          )}

          {/* Chip lane above the plot: the handle's values, or a preview under the pointer */}
          {width > 0 && (
            <motion.div
              className={`num type-label pointer-events-none absolute top-0 whitespace-nowrap rounded-[2px] border bg-bg px-1.5 transition-[opacity,color,border-color] duration-200 ${
                unsafe ? 'border-risk-high text-risk-high-text' : 'border-rule-strong text-ink'
              }`}
              style={{ left: chipLeft, opacity: showGhost ? 0 : 1 }}
              aria-hidden="true"
            >
              {readout(value)}
            </motion.div>
          )}
          {showGhost && (
            <div
              className="num type-label pointer-events-none absolute top-0 whitespace-nowrap rounded-[2px] border border-dashed border-rule-strong bg-bg px-1.5 text-muted"
              style={{ left: chipClamp(x(ghost), chipW(ghostText)) }}
              aria-hidden="true"
            >
              {ghostText}
            </div>
          )}
        </div>
      )}

      {/* One status line, always present, so the column keeps its height as the threshold moves */}
      <div className="mt-1 min-h-[1.3125rem]" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {point && (
            <motion.p
              key={status}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduced ? { duration: 0 } : tQuick}
              className={`flex items-baseline gap-2 type-small ${status === 'unsafe' ? 'text-risk-high-text' : status === 'borderline' ? 'text-ink' : 'text-muted'}`}
              role={status === 'unsafe' ? 'alert' : undefined}
            >
              {status === 'unsafe' && <TriangleAlert size="0.875rem" strokeWidth={1.5} className="shrink-0 self-center" aria-hidden="true" />}
              <span>
                <span className="type-label">{status === 'unsafe' ? 'Unsafe' : status === 'borderline' ? 'Borderline' : 'Safe'}</span>
                {' · '}
                {status === 'unsafe' && (
                  <>
                    sensitivity <span className="num">{formatPercent(point.sensitivity)}</span> — {missWording(point.sensitivity)}
                  </>
                )}
                {status === 'borderline' && (
                  <>
                    sensitivity <span className="num">{formatPercent(point.sensitivity)}</span> ±{formatPoints(point.sensitivityStd)} — within seed noise of{' '}
                    {pct(safeSensitivity)}
                  </>
                )}
                {status === 'safe' && <>sensitivity stays above {pct(safeSensitivity)} beyond seed noise</>}
              </span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
