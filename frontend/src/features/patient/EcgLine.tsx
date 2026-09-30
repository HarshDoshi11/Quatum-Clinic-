import { useReducedMotion } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BEAT_MS, ecgValue } from './heartbeat'

/** Roughly one beat per this many pixels. */
const BEAT_PX = 150
/** The erased gap ahead of the write head, like a bedside monitor. */
const GAP_PX = 18

/**
 * A live ECG line under the Home heart, drawn left → right by a write head on the shared heartbeat clock,
 * so each spike passes the head as the heart pulses. The previous sweep stays faintly ahead of the head.
 * Reduced motion: the whole trace, still.
 */
export function EcgLine({ className = '', running = true, solid = 1 }: { className?: string; running?: boolean; solid?: number }) {
  const reduced = useReducedMotion() ?? false
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const live = useRef<SVGRectElement>(null)
  const old = useRef<SVGRectElement>(null)
  const head = useRef<SVGCircleElement>(null)
  const id = `ecg${useId().replace(/:/g, '')}`

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const beats = Math.max(2, Math.round(size.w / BEAT_PX))
  const beatW = size.w / beats
  // With `solid` < 1 the trace is unfinished: the write head sweeps whole beats up to the cut, and the rest is
  // a faint dashed line.
  const liveBeats = solid >= 1 ? beats : Math.max(1, Math.round(beats * solid))
  const cut = liveBeats * beatW
  const pad = 4
  const y = useMemo(() => {
    const base = size.h * 0.68
    const amp = size.h * 0.6
    return (x: number) => base - ecgValue((x / beatW) % 1) * amp
  }, [size.h, beatW])
  const path = useMemo(() => {
    if (!size.w) return ''
    const pts: string[] = []
    for (let x = 0; x <= size.w; x += 1) pts.push(`${x === 0 ? 'M' : 'L'}${x},${y(x).toFixed(2)}`)
    return pts.join('')
  }, [size.w, y])

  useEffect(() => {
    if (reduced || !running || !size.w) return
    let raf = 0
    const tick = () => {
      const sweep = (performance.now() % (liveBeats * BEAT_MS)) / BEAT_MS // beats into this sweep
      const x = sweep * beatW
      live.current?.setAttribute('width', String(x))
      old.current?.setAttribute('x', String(x + GAP_PX))
      old.current?.setAttribute('width', String(Math.max(0, cut - x - GAP_PX)))
      head.current?.setAttribute('cx', String(x))
      head.current?.setAttribute('cy', String(y(x)))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced, running, size.w, liveBeats, cut, beatW, y])

  return (
    <div ref={box} className={`h-16 w-full text-accent ${className}`} aria-hidden="true">
      {size.w > 0 && (
        <svg width={size.w} height={size.h} viewBox={`0 ${-pad} ${size.w} ${size.h + pad * 2}`} className="block overflow-visible">
          <defs>
            <clipPath id={`${id}-live`}>
              <rect ref={live} x={0} y={-pad} width={reduced ? cut : 0} height={size.h + pad * 2} />
            </clipPath>
            <clipPath id={`${id}-old`}>
              <rect ref={old} x={0} y={-pad} width={reduced ? 0 : cut} height={size.h + pad * 2} />
            </clipPath>
            <clipPath id={`${id}-rest`}>
              <rect x={cut} y={-pad} width={Math.max(0, size.w - cut)} height={size.h + pad * 2} />
            </clipPath>
          </defs>
          <path d={path} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" opacity={0.3} clipPath={`url(#${id}-old)`} />
          <path d={path} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#${id}-live)`} />
          {solid < 1 && (
            <path d={path} fill="none" stroke="currentColor" strokeWidth={1.25} strokeDasharray="3 5" strokeLinecap="round" opacity={0.35} clipPath={`url(#${id}-rest)`} />
          )}
          {!reduced && <circle ref={head} r={3.5} fill="currentColor" />}
        </svg>
      )}
    </div>
  )
}
