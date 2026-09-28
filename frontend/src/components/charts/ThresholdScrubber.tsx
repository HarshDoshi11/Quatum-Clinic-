import { TriangleAlert } from 'lucide-react'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { HairlineTable, type Column } from '@/components/ui/HairlineTable'
import { SegmentedToggle, type SegmentOption } from '@/components/ui/SegmentedToggle'
import { formatPercent, formatPoints } from '@/lib/format'
import { tQuick } from '@/lib/motion'
import { safetyStatus } from '@/lib/safety'
import { useElementSize } from '@/lib/useElementSize'
import type { ThresholdPoint } from '@/types'
import { C, TICK, useChartUnits } from './chartTheme'
import { resolveLabelOffsets } from './directLabels'

type View = 'chart' | 'table'
const VIEW_OPTIONS: readonly SegmentOption<View>[] = [
  { value: 'chart', label: 'Chart' },
  { value: 'table', label: 'Table' },
]

const X_TICKS = [0, 0.25, 0.5, 0.75, 1]
const Y_LINES = [0.5, 1]
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
 * Sensitivity and specificity across decision thresholds, and the slider that picks one:
 * drag or click anywhere on the chart, or use the keyboard. The safe range is where mean
 * sensitivity reaches the safety line; the status under the chart uses the shared
 * noise-aware safety rule. Sizes are rem-based, so projector mode scales it.
 */
export function ThresholdScrubber({ label, curve, value, defaultValue, safeSensitivity, min, max, onChange, onReset }: ThresholdScrubberProps) {
  const id = useId()
  const reduced = useReducedMotion() ?? false
  const units = useChartUnits()
  const [view, setView] = useState<View>('chart')
  const [boxRef, { width }] = useElementSize<HTMLDivElement>()

  // ── Geometry (px, from rem so projector mode scales it)
  const rem = units.rem
  const height = rem * 8.75
  const top = rem * 0.625
  const axis = rem * 1.375
  const left = rem * 2.5
  const right = rem * 6.25
  const plotW = Math.max(1, width - left - right)
  const plotH = height - top - axis
  const x = (v: number) => left + v * plotW
  const y = (v: number) => top + (1 - v) * plotH
  const bottom = y(0)
  const invert = (px: number) => Math.min(max, Math.max(min, (px - left) / plotW))

  const inRange = curve.filter((p) => p.threshold >= min - 1e-9 && p.threshold <= max + 1e-9)
  const range = safeRange(curve, safeSensitivity, min, max)
  const point = curve.find((p) => p.threshold === value)
  const status = point ? safetyStatus(point.sensitivity, point.sensitivityStd, safeSensitivity) : 'safe'
  const unsafe = status === 'unsafe'
  const isDefault = value === defaultValue

  const readout = (v: number) => `Sens ${formatPercent(at(curve, 'sensitivity', v))} · Spec ${formatPercent(at(curve, 'specificity', v))}`

  // ── Spring-driven handle: the dots and readout ride the same value
  const spring = useSpring(value, HANDLE_SPRING)
  useEffect(() => {
    if (reduced) spring.jump(value)
    else spring.set(value)
  }, [value, reduced, spring])
  const hx = useTransform(spring, (v) => left + v * plotW)
  const sensY = useTransform(spring, (v) => top + (1 - at(curve, 'sensitivity', v)) * plotH)
  const specY = useTransform(spring, (v) => top + (1 - at(curve, 'specificity', v)) * plotH)
  const grip = rem * 0.5
  const gripX = useTransform(hx, (px) => px - grip / 2)
  // The readout sits right of the handle, and flips left where it would run off the edge.
  // Mono text, so its width follows from its length (label size, 0.06em tracking, px-1.5 and the border).
  const labelChar = rem * 0.8125 * 0.66
  const readoutWidth = (text: string) => text.length * labelChar + rem * 0.75 + 2
  const flip = (px: number, w: number) => px + rem * 0.5 + w > width
  const room = useMotionValue(0)
  useEffect(() => room.set(width - rem * 0.5 - readoutWidth(readout(value))))
  const readoutShift = useTransform([hx, room], ([px, r]: number[]) => (px > r ? `calc(-100% - ${rem * 0.5}px)` : `${rem * 0.5}px`))

  // ── Pointer: drag anywhere, click jumps, hover previews
  const [dragging, setDragging] = useState(false)
  const [ghost, setGhost] = useState<number | null>(null)
  const [pulse, setPulse] = useState<{ key: number; at: number } | null>(null)
  const snapped = useRef<number | null>(null)
  const snapTargets = [defaultValue, ...(range ? range : [])].filter((t) => t > min + 1e-9 && t < max - 1e-9)

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
  const band = (key: 'sensitivity' | 'specificity', std: 'sensitivityStd' | 'specificityStd') => {
    const upper = inRange.map((p) => `${x(p.threshold)},${y(Math.min(1, p[key] + p[std]))}`)
    const lower = [...inRange].reverse().map((p) => `${x(p.threshold)},${y(Math.max(0, p[key] - p[std]))}`)
    return `M${upper.join('L')}L${lower.join('L')}Z`
  }

  // ── Direct labels in the right gutter, pushed apart where they would touch
  const end = inRange[inRange.length - 1]
  const labelTargets = end
    ? [
        { key: 'sens', value: end.sensitivity },
        { key: 'spec', value: end.specificity },
        { key: 'safe', value: safeSensitivity },
      ]
    : []
  const offsets = resolveLabelOffsets(labelTargets, [0, 1], plotH, units.labelGap)
  const labelY = (key: string, v: number) => y(v) + (offsets[key] ?? 0)

  // ── X ticks: a tick label that would touch the default label is left out (its tick mark stays)
  const charW = rem * 0.8125 * 0.62
  const defaultText = `DEFAULT ${pct(defaultValue)}`
  const defaultHalf = (defaultText.length * charW) / 2
  const tickVisible = (t: number) => Math.abs(x(t) - x(defaultValue)) > defaultHalf + (pct(t).length * charW) / 2 + rem * 0.5
  const tickAnchor = (t: number) => (t === 0 ? 'start' : t === 1 ? 'end' : 'middle')

  const valueText = point
    ? `${pct(value)}: sensitivity ${formatPercent(point.sensitivity)}, specificity ${formatPercent(point.specificity)}${unsafe ? ', unsafe' : ''}`
    : pct(value)
  const showGhost = ghost !== null && ghost !== value && !dragging

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

  return (
    <div ref={boxRef}>
      <div className="flex items-center justify-between gap-3">
        <p id={`${id}-label`} className="flex items-baseline gap-3">
          <span className="type-label text-muted">{label}</span>
          <span className={`num type-small ${unsafe ? 'text-risk-high-text' : 'text-ink'}`}>{pct(value)}</span>
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReset}
            title={`Default ${pct(defaultValue)} · the benchmark operating point`}
            className={`type-label text-ink underline-offset-4 hover:underline ${isDefault ? 'invisible' : ''}`}
            tabIndex={isDefault ? -1 : 0}
            aria-hidden={isDefault}
          >
            Reset to default
          </button>
          <SegmentedToggle<View> options={VIEW_OPTIONS} value={view} onChange={setView} layoutId={`${id}-view`} ariaLabel="Threshold view" size="xs" />
        </div>
      </div>

      {view === 'table' ? (
        <div ref={tableRef} className="relative mt-2 overflow-y-auto" style={{ height }} tabIndex={0} aria-label="Sensitivity and specificity by threshold, scrollable">
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
          className={`relative mt-2 touch-pan-y select-none outline-none focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-accent ${dragging ? 'cursor-grabbing' : 'cursor-ew-resize'}`}
          style={{ height }}
        >
          {width > 0 && (
            <svg width={width} height={height} className="block overflow-visible" aria-hidden="true">
              {/* Safe range: where mean sensitivity reaches the safety line */}
              {range && (
                <>
                  <rect x={x(range[0])} y={top} width={x(range[1]) - x(range[0])} height={plotH} fill={C.riskLow} fillOpacity={0.12} />
                  {zonePulse > 0 && (
                    <motion.rect
                      key={zonePulse}
                      x={x(range[0])}
                      y={top}
                      width={x(range[1]) - x(range[0])}
                      height={plotH}
                      fill={C.riskLow}
                      initial={{ fillOpacity: 0.35 }}
                      animate={{ fillOpacity: 0 }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  )}
                </>
              )}

              {/* Minimal axes: 50% and 100% hairlines, the baseline, round x ticks */}
              {Y_LINES.map((v) => (
                <g key={v}>
                  <line x1={x(0)} x2={x(1)} y1={y(v)} y2={y(v)} stroke={C.rule} />
                  <text x={left - rem * 0.375} y={y(v)} dy="0.35em" textAnchor="end" {...TICK}>
                    {pct(v)}
                  </text>
                </g>
              ))}
              <line x1={x(0)} x2={x(1)} y1={bottom} y2={bottom} stroke={C.ruleStrong} />
              {X_TICKS.map((t) => (
                <g key={t}>
                  <line x1={x(t)} x2={x(t)} y1={bottom} y2={bottom + rem * 0.25} stroke={C.ruleStrong} />
                  {tickVisible(t) && (
                    <text x={x(t)} y={bottom + rem * 0.9} textAnchor={tickAnchor(t)} {...TICK}>
                      {Math.round(t * 100)}
                    </text>
                  )}
                </g>
              ))}
              <line x1={x(defaultValue)} x2={x(defaultValue)} y1={bottom} y2={bottom + rem * 0.375} stroke={C.ink} strokeWidth={1.5} />
              <text x={x(defaultValue)} y={bottom + rem * 0.9} textAnchor="middle" {...TICK} fill={C.ink} letterSpacing="0.06em">
                {defaultText}
              </text>

              {/* 85% safety line */}
              <line x1={x(0)} x2={x(1)} y1={y(safeSensitivity)} y2={y(safeSensitivity)} stroke={C.riskHigh} strokeDasharray="4 4" />

              {/* ±1 std bands (neutral), then the curves: sensitivity is the safety metric, so it is the stronger line */}
              <path d={band('specificity', 'specificityStd')} fill={C.ink} fillOpacity={0.07} />
              <path d={band('sensitivity', 'sensitivityStd')} fill={C.ink} fillOpacity={0.07} />
              <path d={line('specificity')} fill="none" stroke={C.muted} strokeWidth={1.5} />
              <path d={line('sensitivity')} fill="none" stroke={C.accent} strokeWidth={2} />

              {/* Direct labels at the right end */}
              {end && (
                <g {...TICK}>
                  <text x={x(1) + rem * 0.5} y={labelY('sens', end.sensitivity)} dy="0.35em" fill={C.ink}>
                    Sensitivity
                  </text>
                  <text x={x(1) + rem * 0.5} y={labelY('spec', end.specificity)} dy="0.35em" fill={C.ink}>
                    Specificity
                  </text>
                  <text x={x(1) + rem * 0.5} y={labelY('safe', safeSensitivity)} dy="0.35em" fill={C.ink} letterSpacing="0.06em">
                    {pct(safeSensitivity)} SAFETY
                  </text>
                </g>
              )}

              {/* Hover preview */}
              {showGhost && <line x1={x(ghost)} x2={x(ghost)} y1={top} y2={bottom} stroke={C.ruleStrong} strokeDasharray="3 3" />}

              {/* Handle: line, grip, and the dots riding both curves */}
              <motion.line
                x1={hx}
                x2={hx}
                y1={top}
                y2={bottom}
                stroke={unsafe ? C.riskHigh : C.ink}
                strokeWidth={1.5}
                style={{ transition: 'stroke 200ms' }}
              />
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
                fill={unsafe ? C.riskHigh : C.ink}
                stroke={C.bg}
                strokeWidth={1}
                style={{ transition: 'fill 200ms' }}
              />
              {/* Drawn over the handle with a background halo, so the handle never cuts through it */}
              {range && (
                <text
                  x={x(range[0]) + rem * 0.375}
                  y={bottom - rem * 0.375}
                  {...TICK}
                  fill={C.ink}
                  stroke={C.bg}
                  strokeWidth={4}
                  paintOrder="stroke"
                  letterSpacing="0.06em"
                >
                  SAFE RANGE {Math.round(range[0] * 100)}–{pct(range[1])}
                </text>
              )}
              <motion.circle cx={hx} cy={specY} r={4} fill={C.bg} stroke={C.muted} strokeWidth={2} />
              <motion.circle cx={hx} cy={sensY} r={4} fill={C.bg} stroke={C.accent} strokeWidth={2} />
            </svg>
          )}

          {/* Readouts: the handle's values, and a muted preview under the pointer */}
          {width > 0 && (
            <motion.div
              className={`num type-label pointer-events-none absolute whitespace-nowrap rounded-[2px] border bg-bg px-1.5 transition-colors duration-200 ${
                unsafe ? 'border-risk-high text-risk-high-text' : 'border-rule text-ink'
              }`}
              style={{ left: hx, top: 0, x: readoutShift }}
              aria-hidden="true"
            >
              {readout(value)}
            </motion.div>
          )}
          {showGhost && (
            <div
              className="num type-label pointer-events-none absolute whitespace-nowrap rounded-[2px] border border-dashed border-rule-strong bg-bg px-1.5 text-muted"
              style={{
                left: x(ghost),
                top: rem * 1.625,
                translate: flip(x(ghost), readoutWidth(`${pct(ghost)} · ${readout(ghost)}`)) ? `calc(-100% - ${rem * 0.5}px)` : `${rem * 0.5}px`,
              }}
              aria-hidden="true"
            >
              {pct(ghost)} · {readout(ghost)}
            </div>
          )}
        </div>
      )}

      {/* One status line, always present, so the column keeps its height as the threshold moves */}
      <div className="mt-1.5 min-h-[1.3125rem]" aria-live="polite">
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
