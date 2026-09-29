import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { PatientHome } from '@/lib/domain'
import { useThemeColors } from '@/lib/useThemeColors'
import { beatPhase, pulseScale } from './heartbeat'
import { SCENE_DPR, useSceneActivity } from '@/components/three/useSceneActivity'

/**
 * A low-poly heart: an icosphere whose every vertex is pushed out along its direction onto the classic
 * implicit heart surface (x² + 9/4·d² + y² − 1)³ − x²·y³ − 9/80·d²·y³ = 0, then shaded flat, so the form
 * reads as even, stylised facets.
 */
function heartGeometry(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 3)
  const inside = (x: number, y: number, d: number) => (x * x + 2.25 * d * d + y * y - 1) ** 3 - x * x * y ** 3 - 0.1125 * d * d * y ** 3 < 0
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const dir = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    dir.fromBufferAttribute(pos, i).normalize()
    // March out to the surface, then refine by bisection (the heart is star-shaped around its centre).
    let lo = 0
    let hi = 0.05
    while (hi < 2 && inside(dir.x * hi, dir.y * hi, dir.z * hi)) {
      lo = hi
      hi += 0.05
    }
    for (let k = 0; k < 20; k++) {
      const mid = (lo + hi) / 2
      if (inside(dir.x * mid, dir.y * mid, dir.z * mid)) lo = mid
      else hi = mid
    }
    const r = ((lo + hi) / 2) * 0.88
    pos.setXYZ(i, dir.x * r, dir.y * r + 0.05, dir.z * r)
  }
  g.computeVertexNormals()
  return g
}

/** A soft cluster of cells (breast-tissue checks): faceted bodies with darker nuclei. */
const CELLS: { p: [number, number, number]; r: number }[] = [
  { p: [0, 0, 0], r: 0.7 },
  { p: [0.95, 0.35, -0.2], r: 0.48 },
  { p: [-0.85, 0.45, 0.1], r: 0.54 },
  { p: [0.3, -0.88, 0.25], r: 0.46 },
  { p: [-0.55, -0.7, -0.35], r: 0.4 },
  { p: [0.62, 0.95, 0.35], r: 0.34 },
]

function Form({ shape, animate, form, nucleus }: { shape: PatientHome['hero']; animate: boolean; form: string; nucleus: string }) {
  const group = useRef<THREE.Group>(null)
  const heart = useMemo(() => (shape === 'heart' ? heartGeometry() : null), [shape])
  useEffect(() => () => heart?.dispose(), [heart])
  // The pointer anywhere on the page steers the parallax: −1…1 across the viewport, not the canvas.
  const pointer = useRef({ x: 0, y: 0 })
  useEffect(() => {
    if (!animate) return
    const onMove = (e: PointerEvent) => {
      pointer.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -((e.clientY / window.innerHeight) * 2 - 1) }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [animate])

  useFrame(() => {
    const g = group.current
    if (!g || !animate) return
    const now = performance.now()
    const t = now / 1000
    // Heart: pulses on the shared 60 bpm clock (in step with the ECG line). Cells: a slow breath instead.
    g.scale.setScalar(shape === 'heart' ? pulseScale(beatPhase(now)) : 1 + 0.02 * (1 - Math.cos((t / 5) * Math.PI * 2)))
    // Slow idle turn, leaning and shifting a little toward the pointer (parallax).
    const { x: px, y: py } = pointer.current
    g.rotation.y += (Math.sin(t * 0.22) * 0.45 - 0.3 + px * 0.3 - g.rotation.y) * 0.04
    g.rotation.x += (-py * 0.18 + 0.04 + Math.sin(t * 0.17) * 0.05 - g.rotation.x) * 0.04
    g.position.x += (px * 0.08 - g.position.x) * 0.04
    g.position.y += (py * 0.06 - g.position.y) * 0.04
  })

  return (
    <group ref={group} rotation={[0.04, -0.3, 0]}>
      {heart ? (
        <mesh geometry={heart}>
          <meshStandardMaterial color={form} roughness={0.62} metalness={0} flatShading />
        </mesh>
      ) : (
        CELLS.map((c, i) => (
          <group key={i} position={c.p}>
            <mesh>
              <icosahedronGeometry args={[c.r, 2]} />
              <meshStandardMaterial color={form} roughness={0.7} flatShading transparent opacity={0.94} />
            </mesh>
            <mesh position={[c.r * 0.15, c.r * 0.1, c.r * 0.58]}>
              <icosahedronGeometry args={[c.r * 0.32, 1]} />
              <meshStandardMaterial color={nucleus} roughness={0.8} flatShading />
            </mesh>
          </group>
        ))
      )}
    </group>
  )
}

export interface HeroSceneProps {
  shape: PatientHome['hero']
  /** False = a still render (reduced motion). */
  animate: boolean
}

/**
 * Patient Home's 3D hero (lazy-loaded via lazyScene): a stylised heart (or cell cluster) in a dusty rose,
 * warmly lit, pulsing at 60 bpm with a slow idle turn and a little pointer parallax. Colours come from the
 * theme tokens (--hero-form, --hero-light).
 */
export default function HeroScene({ shape, animate }: HeroSceneProps) {
  const scene = useSceneActivity<HTMLCanvasElement>()
  const colors = useThemeColors()
  return (
    <Canvas
      ref={scene.ref}
      dpr={SCENE_DPR}
      camera={{ position: [0, 0, 5.4], fov: 32 }}
      gl={{ antialias: true, alpha: true }}
      frameloop={!scene.active ? 'never' : animate ? 'always' : 'demand'}
      aria-hidden="true"
    >
      {/* Sky: the warm light; ground: the form's own colour, so the underside stays warm in both themes */}
      <hemisphereLight args={[colors.heroLight.hex, colors.heroForm.hex, 1]} />
      <directionalLight position={[2.5, 3, 4]} intensity={2.1} color={colors.heroLight.hex} />
      {/* Rim light from behind, so the edge separates softly from the page */}
      <directionalLight position={[-3, 2.5, -4]} intensity={1.6} color={colors.heroLight.hex} />
      <Form shape={shape} animate={animate} form={colors.heroForm.hex} nucleus={colors.accent.hex} />
    </Canvas>
  )
}
