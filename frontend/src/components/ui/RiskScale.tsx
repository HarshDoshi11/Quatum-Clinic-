import { motion, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react'
import { useEffect } from 'react'
import { formatPercent } from '@/lib/format'
import { springPrecise } from '@/lib/motion'

const TICKS = [0, 0.25, 0.5, 0.75, 1]

/** A value in [0, 1] that springs to its target (jumps under reduced motion). */
function useSprung(target: number): MotionValue<number> {
  const reduced = useReducedMotion()
  const spring = useSpring(target, { stiffness: springPrecise.stiffness ?? 120, damping: springPrecise.damping ?? 20 })
  useEffect(() => {
    if (reduced) spring.jump(target)
    else spring.set(target)
  }, [target, reduced, spring])
  return spring
}

/** Keeps a label centred on its x, but inside the track at the ends (0–100%). */
const edgeShift = (v: number) => (v < 0.08 ? '0%' : v > 0.92 ? '-100%' : '-50%')

interface RiskScaleProps {
  /** Probability in [0, 1]. */
  value: number
  /** 5-seed range [low, high]. */
  interval: [number, number] | null
  threshold: number
  /** [moderate, high] band edges, from the dataset config. */
  edges: [number, number]
  className?: string
}

/**
 * Horizontal 0–100% risk scale: muted low / moderate / high zones, the 5-seed range
 * as a darker strip, an ink marker with its value, and the decision threshold as a
 * tick labelled below. Sizes are rem, so projector mode scales it.
 */
export function RiskScale({ value, interval, threshold, edges, className = '' }: RiskScaleProps) {
  const [moderate, high] = edges
  const pos = useSprung(value)
  const left = useTransform(pos, (v) => `${v * 100}%`)
  const lo = useSprung(interval?.[0] ?? value)
  const hi = useSprung(interval?.[1] ?? value)
  const stripLeft = useTransform(lo, (v) => `${v * 100}%`)
  const stripWidth = useTransform([lo, hi], ([a, b]: number[]) => `${Math.max(0, b - a) * 100}%`)
  const t = useSprung(threshold)
  const tLeft = useTransform(t, (v) => `${v * 100}%`)
  const valueShift = useTransform(pos, edgeShift)
  const tShift = useTransform(t, edgeShift)

  // The zone the marker sits in (same rule as the risk band) renders at full strength.
  const active = value < moderate ? 0 : value < high ? 1 : 2
  const zones = [
    { from: 0, to: moderate, cls: 'bg-risk-low' },
    { from: moderate, to: high, cls: 'bg-risk-mid' },
    { from: high, to: 1, cls: 'bg-risk-high' },
  ]
  // A 1px background halo keeps the ink marker and tick distinguishable on any zone colour.
  const halo = { boxShadow: '0 0 0 1px var(--bg)' }

  return (
    <div className={`select-none ${className}`} role="img" aria-label={`Risk scale: estimate ${formatPercent(value)}, decision threshold ${Math.round(threshold * 100)}%`}>
      {/* Marker value, then the triangle: stacked rows (no negative offsets), so the label never clips at any value or scale */}
      <div className="pt-1" aria-hidden="true">
        <div className="relative h-[1.3125rem]">
          <motion.span className="num absolute top-0 whitespace-nowrap type-small text-ink" style={{ left, x: valueShift }}>
            {formatPercent(value)}
          </motion.span>
        </div>
        <div className="relative mt-0.5 h-[0.4375rem]">
          <motion.span className="absolute top-0 block -translate-x-1/2" style={{ left }}>
            <svg width="10" height="7" viewBox="0 0 10 7" className="block h-[0.4375rem] w-[0.625rem]">
              <path d="M0 0 H10 L5 7 Z" fill="var(--ink)" />
            </svg>
          </motion.span>
        </div>
      </div>

      {/* Track: zones, seed-range overlay, threshold tick, marker line */}
      <div className="relative mt-0.5 h-[0.625rem]" aria-hidden="true">
        {zones.map((z, i) => (
          <span
            key={z.cls}
            className={`absolute inset-y-0 ${z.cls} transition-opacity duration-300`}
            style={{ left: `${z.from * 100}%`, width: `${(z.to - z.from) * 100}%`, opacity: i === active ? 'var(--risk-zone-active-opacity)' : 'var(--risk-zone-opacity)' }}
          />
        ))}
        {/* Ink at 25% with 1px ink edges: the zone colour shows through. */}
        {interval && <motion.span className="absolute inset-y-0 border-x border-ink bg-ink/25" style={{ left: stripLeft, width: stripWidth }} />}
        <motion.span className="absolute -inset-y-1 w-px -translate-x-1/2 bg-ink" style={{ left: tLeft, ...halo }} />
        <motion.span className="absolute -inset-y-0.5 w-[2px] -translate-x-1/2 bg-ink" style={{ left, ...halo }} />
      </div>

      {/* Axis tick labels */}
      <div className="relative mt-1.5 h-[1.25rem]" aria-hidden="true">
        {TICKS.map((v) => (
          <span key={v} className="type-label absolute top-0 text-muted" style={{ left: `${v * 100}%`, translate: edgeShift(v) }}>
            {Math.round(v * 100)}
          </span>
        ))}
      </div>

      {/* Threshold label on its own row below the axis, so it can never overlap a tick label */}
      <div className="relative h-[1.25rem]" aria-hidden="true">
        <motion.span className="type-label absolute top-0 whitespace-nowrap text-ink" style={{ left: tLeft, x: tShift }}>
          Threshold {Math.round(threshold * 100)}%
        </motion.span>
      </div>
    </div>
  )
}
