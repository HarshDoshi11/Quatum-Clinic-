import { useReducedMotion } from 'motion/react'
import { Component, type ReactNode } from 'react'
import { lazyScene, SceneFrame } from '@/components/three/LazyScene'
import type { PatientHome } from '@/lib/domain'

const HeroScene = lazyScene(() => import('./HeroScene'))

const CELLS_2D: [number, number, number][] = [
  [0, 0, 7],
  [9.5, -3.5, 4.8],
  [-8.5, -4.5, 5.4],
  [3, 8.8, 4.6],
  [-5.5, 7, 4],
]

/** A still picture of the hero, shown while the 3D loads and wherever WebGL is unavailable. */
export function HeroStill({ shape }: { shape: PatientHome['hero'] }) {
  return (
    <svg viewBox="-20 -20 40 40" className="h-full w-full" style={{ color: 'var(--hero-form)' }} aria-hidden="true">
      {shape === 'heart' ? (
        <g transform="translate(0 1.2) scale(0.9)">
          <path d="M0 -7.5 C -3 -14 -15 -13.5 -15 -4.5 C -15 3 -6 8.5 0 14 C 6 8.5 15 3 15 -4.5 C 15 -13.5 3 -14 0 -7.5 Z" fill="currentColor" />
          {/* Two soft facets suggest the 3D form's light */}
          <path d="M0 -7.5 C -3 -14 -15 -13.5 -15 -4.5 L -6 -2 Z" fill="var(--bg)" opacity="0.18" />
          <path d="M0 14 C 6 8.5 15 3 15 -4.5 L 5 3 Z" fill="var(--ink)" opacity="0.12" />
        </g>
      ) : (
        <g fill="currentColor">
          {CELLS_2D.map(([x, y, r]) => (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r={r} opacity="0.9" />
              <circle cx={x + r * 0.15} cy={y - r * 0.1} r={r * 0.32} fill="var(--accent)" />
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

/** If the 3D scene fails (no GPU, a lost context), the still picture takes its place. */
export class HeroBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

let webgl: boolean | null = null

/** Patient Home's hero picture: the lazy-loaded 3D form, with the still SVG as its fallback. */
export function HeroVisual({ shape }: { shape: PatientHome['hero'] }) {
  const reduced = useReducedMotion() ?? false
  webgl ??= hasWebGL()
  const still = <HeroStill shape={shape} />
  if (!webgl) return still
  return (
    <HeroBoundary fallback={still}>
      <SceneFrame fallback={still}>
        <HeroScene shape={shape} animate={!reduced} />
      </SceneFrame>
    </HeroBoundary>
  )
}
