import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'

const W = 1600
const H = 120
const BASE = 72
/** One heartbeat every this many units along the line. */
const BEAT = 230

/** A calm ECG trace across the full width: flat, a small P wave, the QRS spike, a rounded T wave. */
function tracePath(): string {
  let d = `M0 ${BASE}`
  for (let x0 = 40; x0 + 160 < W; x0 += BEAT) {
    d +=
      ` L${x0} ${BASE}` +
      ` q9 -10 18 0` + // P
      ` l14 0 l5 6 l7 -52 l8 66 l6 -20` + // QRS
      ` l18 0 q16 -18 32 0` + // T
      ` L${x0 + BEAT - 20} ${BASE}`
  }
  return `${d} L${W} ${BASE}`
}

/**
 * A live ECG line drawing slowly and continuously across the screen, like a calm monitor, in the accent
 * at low opacity. `excited` briefly quickens the sweep, which then settles. Still under reduced motion.
 */
export function EcgLine({ excited = false, className = '' }: { excited?: boolean; className?: string }) {
  const reduced = useReducedMotion() ?? false
  const path = useRef<SVGPathElement>(null)
  const d = useMemo(tracePath, [])
  const boostUntil = useRef(0)
  useEffect(() => {
    if (excited) boostUntil.current = performance.now() + 1400
  }, [excited])

  useEffect(() => {
    const el = path.current
    if (!el) return
    const length = el.getTotalLength()
    el.style.strokeDasharray = `${length} ${length}`
    if (reduced) {
      el.style.strokeDashoffset = '0'
      el.style.opacity = '1'
      return
    }
    let progress = 0
    let speed = 1
    let last = performance.now()
    let raf = 0
    const SWEEP_SECONDS = 9
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      // Quicken while boosted, then ease back to the resting rhythm.
      const target = now < boostUntil.current ? 2.6 : 1
      speed += (target - speed) * Math.min(1, dt * 3)
      progress += (dt * speed) / SWEEP_SECONDS
      // Draw across, then fade the trace and start a new sweep.
      const cycle = progress % 1.12
      el.style.strokeDashoffset = String(length * (1 - Math.min(1, cycle)))
      el.style.opacity = cycle > 1 ? String(1 - (cycle - 1) / 0.12) : '1'
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`pointer-events-none block h-[7.5rem] w-full ${className}`} aria-hidden="true">
      <path ref={path} d={d} fill="none" stroke="var(--accent)" strokeOpacity={0.28} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
