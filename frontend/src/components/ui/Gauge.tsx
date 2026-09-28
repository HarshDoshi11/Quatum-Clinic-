import { motion, useReducedMotion, useSpring } from 'motion/react'
import { useEffect } from 'react'
import { springPrecise } from '@/lib/motion'
import type { RiskBand } from '@/types'

const RISK_STROKE: Record<RiskBand, string> = { low: 'var(--risk-low)', moderate: 'var(--risk-mid)', high: 'var(--risk-high)' }

const R = 90
const CX = 100
const CY = 100
const ARC = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`

/** Point on the arc for a value in [0, 1] (0 = left end, 1 = right end), at radius r. */
const at = (v: number, r: number) => {
  const a = Math.PI * (1 - v)
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) }
}

interface GaugeProps {
  /** Fraction in [0, 1]. */
  value: number
  band: RiskBand
  /** Decision threshold, drawn as a tick across the arc. */
  threshold?: number
  /** Band edges, drawn as small ticks outside the arc. */
  ticks?: number[]
  label: string
  className?: string
}

/** Thin semicircular gauge; the filled arc springs to the value. Width follows the container. */
export function Gauge({ value, band, threshold, ticks = [], label, className = '' }: GaugeProps) {
  const reduced = useReducedMotion()
  const spring = useSpring(reduced ? value : 0, { stiffness: springPrecise.stiffness ?? 120, damping: springPrecise.damping ?? 20 })
  useEffect(() => {
    if (reduced) spring.jump(value)
    else spring.set(value)
  }, [value, reduced, spring])

  const t0 = threshold !== undefined ? at(threshold, R - 9) : null
  const t1 = threshold !== undefined ? at(threshold, R + 9) : null

  return (
    <svg viewBox="0 0 200 112" className={`block w-full ${className}`} role="img" aria-label={label}>
      <path d={ARC} fill="none" stroke="var(--rule-strong)" strokeWidth={1.5} />
      <motion.path d={ARC} fill="none" stroke={RISK_STROKE[band]} strokeWidth={6} style={{ pathLength: spring }} />
      {ticks.map((v) => {
        const a = at(v, R + 4)
        const b = at(v, R + 8)
        return <line key={v} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--muted)" strokeWidth={1} />
      })}
      {t0 && t1 && <line x1={t0.x} y1={t0.y} x2={t1.x} y2={t1.y} stroke="var(--ink)" strokeWidth={1.5} />}
    </svg>
  )
}
