import { motion, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react'
import { useEffect } from 'react'
import { formatPercent } from '@/lib/format'
import { springPrecise } from '@/lib/motion'
import { useElementSize } from '@/lib/useElementSize'

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

  // Ticks and the threshold label share one row: hide a tick label only where the threshold label would cover it.
  const [trackRef, track] = useElementSize<HTMLDivElement>()
  const rem = typeof window === 'undefined' ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const thresholdText = `Threshold ${Math.round(threshold * 100)}%`
  const labelW = track.width > 0 ? ((thresholdText.length + 2) * 0.62 * 0.8125 * rem) / track.width : 0.2
  const [from, to] = threshold < 0.08 ? [threshold, threshold + labelW] : threshold > 0.92 ? [threshold - labelW, threshold] : [threshold - labelW / 2, threshold + labelW / 2]
  const tickHalf = track.width > 0 ? (3.5 * 0.62 * 0.8125 * rem) / 2 / track.width : 0.03
  const covered = (v: number) => v + tickHalf > from && v - tickHalf < to

  const zones = [
    { from: 0, to: moderate, cls: 'bg-risk-low' },
    { from: moderate, to: high, cls: 'bg-risk-mid' },
    { from: high, to: 1, cls: 'bg-risk-high' },
  ]

  return (
    <div className={`select-none ${className}`} role="img" aria-label={`Risk scale: estimate ${formatPercent(value)}, decision threshold ${Math.round(threshold * 100)}%`}>
      {/* Marker value + triangle */}
      <div className="relative h-[1.75rem]" aria-hidden="true">
        <motion.span className="num absolute bottom-[0.55rem] whitespace-nowrap type-small text-ink" style={{ left, x: valueShift }}>
          {formatPercent(value)}
        </motion.span>
        <motion.span className="absolute bottom-0 block -translate-x-1/2" style={{ left }}>
          <svg width="10" height="7" viewBox="0 0 10 7" className="block h-[0.4375rem] w-[0.625rem]">
            <path d="M0 0 H10 L5 7 Z" fill="var(--ink)" />
          </svg>
        </motion.span>
      </div>

      {/* Track: zones, seed-range strip, threshold tick, marker line */}
      <div ref={trackRef} className="relative mt-0.5 h-[0.625rem]" aria-hidden="true">
        {zones.map((z) => (
          <span key={z.cls} className={`absolute inset-y-0 ${z.cls} opacity-25`} style={{ left: `${z.from * 100}%`, width: `${(z.to - z.from) * 100}%` }} />
        ))}
        {interval && <motion.span className="absolute inset-y-0 bg-ink/35" style={{ left: stripLeft, width: stripWidth }} />}
        <motion.span className="absolute -inset-y-1 w-px -translate-x-1/2 bg-ink" style={{ left: tLeft }} />
        <motion.span className="absolute -inset-y-0.5 w-[2px] -translate-x-1/2 bg-ink" style={{ left }} />
      </div>

      {/* Tick labels + the threshold label (ink) in one row */}
      <div className="relative mt-1.5 h-[1.25rem]" aria-hidden="true">
        {TICKS.filter((v) => !covered(v)).map((v) => (
          <span key={v} className="type-label absolute top-0 text-muted" style={{ left: `${v * 100}%`, translate: edgeShift(v) }}>
            {Math.round(v * 100)}
          </span>
        ))}
        <motion.span className="type-label absolute top-0 whitespace-nowrap bg-bg px-1 text-ink" style={{ left: tLeft, x: tShift }}>
          {thresholdText}
        </motion.span>
      </div>
    </div>
  )
}
