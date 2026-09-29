import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { lazyScene, SceneFrame } from '@/components/three/LazyScene'
import { EcgLine } from '../EcgLine'
import { hasWebGL, HeroBoundary } from '../HeroVisual'
import { makeHeartCloud } from './heartCloud'
import { READY_FRACTION, STARTED_FRACTION } from './roadmap'

const ParticleHeartScene = lazyScene(() => import('./ParticleHeartScene'))

/** The still heart: the same points (fewer), seen from the front. Settled ones solid, waiting ones faint. */
function HeartDots() {
  const dots = useMemo(() => {
    const c = makeHeartCloud(520, READY_FRACTION)
    return Array.from({ length: c.count }, (_, i) => {
      const src = c.settled[i] ? c.target : c.drift
      return { x: src[i * 3], y: -src[i * 3 + 1], z: src[i * 3 + 2], settled: c.settled[i] === 1, coral: c.coral[i] === 1, s: c.size[i] }
    })
      .filter((d) => !d.settled || d.z > -0.1)
      .sort((a, b) => a.z - b.z)
  }, [])
  return (
    <svg viewBox="-1.6 -1.6 3.2 3.2" className="h-full w-full" aria-hidden="true">
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={(d.settled ? 0.011 : 0.009) * d.s}
          fill={d.coral ? 'var(--coral)' : 'var(--accent)'}
          opacity={d.settled ? 0.5 + 0.4 * (d.z + 0.1) : 0.25}
        />
      ))}
    </svg>
  )
}

let webgl: boolean | null = null

/**
 * The teaser hero: the particle heart, under construction (the ready share of the roadmap has settled), and the
 * ECG line on the same 60 bpm clock, solid for what is built and dashed for the rest. Both pause off-screen.
 * Reduced motion: the heart as it stands, still.
 */
export function ParticleHeart() {
  const reduced = useReducedMotion() ?? false
  const box = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  webgl ??= hasWebGL()

  useEffect(() => {
    const el = box.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const still = <HeartDots />
  return (
    <div ref={box} className="flex w-full flex-col items-center">
      <div className="aspect-square w-full max-w-[min(100%,54svh)]">
        {webgl ? (
          <HeroBoundary fallback={still}>
            <SceneFrame fallback={still}>
              <ParticleHeartScene animate={!reduced} visible={visible} settledFraction={READY_FRACTION} />
            </SceneFrame>
          </HeroBoundary>
        ) : (
          still
        )}
      </div>
      <EcgLine className="mt-1 max-w-[30rem]" running={visible} solid={STARTED_FRACTION} />
    </div>
  )
}
