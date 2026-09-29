import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { lazyScene, SceneFrame } from '@/components/three/LazyScene'
import { EcgLine } from '../EcgLine'
import { hasWebGL, HeroBoundary } from '../HeroVisual'
import { makeHeartCloud } from './heartCloud'

const ParticleHeartScene = lazyScene(() => import('./ParticleHeartScene'))

/** The still heart: the same points (fewer), seen from the front, as soft dots. Loading and no-WebGL fallback. */
function HeartDots() {
  const dots = useMemo(() => {
    const c = makeHeartCloud(520)
    return Array.from({ length: c.count }, (_, i) => ({ x: c.target[i * 3], y: -c.target[i * 3 + 1], z: c.target[i * 3 + 2], coral: c.coral[i] === 1, s: c.size[i] }))
      .filter((d) => d.z > -0.1)
      .sort((a, b) => a.z - b.z)
  }, [])
  return (
    <svg viewBox="-1.25 -1.25 2.5 2.5" className="h-full w-full" aria-hidden="true">
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={0.011 * d.s} fill={d.coral ? 'var(--coral)' : 'var(--accent)'} opacity={0.5 + 0.4 * (d.z + 0.1)} />
      ))}
    </svg>
  )
}

let webgl: boolean | null = null

/**
 * The teaser hero: the particle heart and, under it, the live ECG line on the same 60 bpm clock. Both pause
 * while off-screen. Reduced motion: the formed heart and a still trace.
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
              <ParticleHeartScene animate={!reduced} visible={visible} />
            </SceneFrame>
          </HeroBoundary>
        ) : (
          still
        )}
      </div>
      <EcgLine className="mt-1 max-w-[30rem]" running={visible} />
    </div>
  )
}
