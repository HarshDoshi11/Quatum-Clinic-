import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { HeroShape } from '@/lib/domain'
import { useThemeColors } from '@/lib/useThemeColors'

/**
 * A smooth, closed heart surface (a parametric "pillow" heart): cross-sections run from an ellipse at the
 * face centre to the classic heart curve at the rim, scaled by sin(u) so every edge is round. Normals are fixed at the poles and the seam so the
 * surface shades without pinches.
 */
function heartGeometry(): THREE.BufferGeometry {
  const NU = 72
  const NV = 144
  const positions: number[] = []
  for (let i = 0; i <= NU; i++) {
    const u = (i / NU) * Math.PI
    for (let j = 0; j <= NV; j++) {
      const v = (j / NV) * Math.PI * 2
      // Cross-sections blend from a soft ellipse at the face centre to the heart outline at the rim, so
      // the cleft and the tip shape the silhouette without carving a groove through the face.
      const w = Math.sin(u) ** 3
      const hx = 15 * Math.sin(v) - 4 * Math.sin(3 * v)
      const hy = 15 * Math.cos(v) - 5 * Math.cos(2 * v) - 2 * Math.cos(3 * v) - Math.cos(4 * v)
      const ex = 13 * Math.sin(v)
      const ey = 12 * Math.cos(v) - 1
      const x = Math.sin(u) * (ex + (hx - ex) * w)
      const y = Math.sin(u) * (ey + (hy - ey) * w)
      const z = 7 * Math.cos(u)
      positions.push(x / 17, y / 17 + 0.12, z / 17)
    }
  }
  const index: number[] = []
  const row = NV + 1
  for (let i = 0; i < NU; i++)
    for (let j = 0; j < NV; j++) {
      const a = i * row + j
      const b = a + row
      index.push(a, b, a + 1, b, b + 1, a + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  const n = g.getAttribute('normal') as THREE.BufferAttribute
  // Poles (the centres of the front and back faces): every duplicate takes the average of the ring around
  // it, which is the surface's true normal there (the dome's apex is slightly off-centre).
  for (const [pole, ring] of [
    [0, 1],
    [NU, NU - 1],
  ] as const) {
    const avg = new THREE.Vector3()
    for (let j = 0; j < NV; j++) avg.add(new THREE.Vector3().fromBufferAttribute(n, ring * row + j))
    avg.normalize()
    for (let j = 0; j <= NV; j++) n.setXYZ(pole * row + j, avg.x, avg.y, avg.z)
  }
  // The seam (v = 0 and v = 2π are the same points): share one averaged normal.
  const va = new THREE.Vector3()
  const vb = new THREE.Vector3()
  for (let i = 1; i < NU; i++) {
    const a = i * row
    const b = a + NV
    va.fromBufferAttribute(n, a)
    vb.fromBufferAttribute(n, b)
    va.add(vb).normalize()
    n.setXYZ(a, va.x, va.y, va.z)
    n.setXYZ(b, va.x, va.y, va.z)
  }
  // The centre line (the top cleft and the bottom tip are cusps of the curve): shade it smoothly by making
  // its normals symmetric, so there is no crease down the middle.
  for (let i = 0; i <= NU; i++)
    for (const j of [0, NV / 2, NV]) {
      const k = i * row + j
      va.fromBufferAttribute(n, k)
      va.x = 0
      if (va.lengthSq() < 1e-6) va.set(0, 0, i < NU / 2 ? 1 : -1)
      va.normalize()
      n.setXYZ(k, va.x, va.y, va.z)
    }
  n.needsUpdate = true
  return g
}

/** A soft cluster of cells: rounded bodies with darker centres. */
const CELLS: { p: [number, number, number]; r: number }[] = [
  { p: [0, 0, 0], r: 0.72 },
  { p: [0.95, 0.35, -0.2], r: 0.5 },
  { p: [-0.85, 0.45, 0.1], r: 0.55 },
  { p: [0.3, -0.9, 0.25], r: 0.48 },
  { p: [-0.55, -0.7, -0.35], r: 0.42 },
  { p: [0.6, 0.95, 0.35], r: 0.36 },
  { p: [-0.2, 0.9, -0.55], r: 0.34 },
]

interface FormProps {
  shape: HeroShape
  animate: boolean
  interactive: boolean
  pulseKey: number
  main: string
  soft: string
}

function Form({ shape, animate, interactive, pulseKey, main, soft }: FormProps) {
  const group = useRef<THREE.Group>(null)
  const heart = useMemo(() => (shape === 'heart' ? heartGeometry() : null), [shape])
  const pulseStart = useRef<number | null>(null)
  useEffect(() => {
    if (pulseKey > 0) pulseStart.current = -1 // set on the next frame
  }, [pulseKey])
  useEffect(() => () => heart?.dispose(), [heart])

  useFrame((state) => {
    const g = group.current
    if (!g || !animate) return
    const t = state.clock.elapsedTime
    // Breathe 1.0 ↔ 1.04 over ~5s, plus a single soft pulse when asked.
    let scale = 1 + 0.02 * (1 - Math.cos((t / 5) * Math.PI * 2))
    if (pulseStart.current === -1) pulseStart.current = t
    if (pulseStart.current !== null) {
      const k = (t - pulseStart.current) / 0.7
      if (k >= 1) pulseStart.current = null
      else scale *= 1 + 0.09 * Math.sin(k * Math.PI)
    }
    g.scale.setScalar(scale)
    // Slow drift, leaning gently toward the pointer.
    const px = interactive ? state.pointer.x : 0
    const py = interactive ? state.pointer.y : 0
    g.rotation.y += (Math.sin(t * 0.25) * 0.35 + px * 0.35 - g.rotation.y) * 0.04
    g.rotation.x += (-py * 0.22 + Math.sin(t * 0.18) * 0.05 - g.rotation.x) * 0.04
  })

  return (
    <group ref={group}>
      {heart ? (
        <mesh geometry={heart}>
          <meshStandardMaterial color={main} roughness={0.72} metalness={0} />
        </mesh>
      ) : (
        CELLS.map((c, i) => (
          <group key={i} position={c.p}>
            <mesh>
              <sphereGeometry args={[c.r, 48, 48]} />
              <meshStandardMaterial color={i % 2 ? soft : main} roughness={0.8} transparent opacity={0.92} />
            </mesh>
            <mesh position={[c.r * 0.15, c.r * 0.1, c.r * 0.55]}>
              <sphereGeometry args={[c.r * 0.34, 32, 32]} />
              <meshStandardMaterial color={i % 2 ? main : soft} roughness={0.9} />
            </mesh>
          </group>
        ))
      )}
    </group>
  )
}

export interface HeroSceneProps {
  shape: HeroShape
  /** False = a still render (reduced motion). */
  animate: boolean
  /** Leans toward the pointer. */
  interactive?: boolean
  /** Increment to pulse once. */
  pulseKey?: number
}

/**
 * Patient Mode's 3D hero (lazy-loaded via lazyScene): a matte form in the accent and sage tones, under
 * soft studio light with a rim light behind, breathing slowly. Colours come from the theme tokens.
 */
export default function HeroScene({ shape, animate, interactive = true, pulseKey = 0 }: HeroSceneProps) {
  const colors = useThemeColors()
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 5.2], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
      frameloop={animate ? 'always' : 'demand'}
      // Pointer anywhere on the page steers the lean, not just over the canvas.
      eventSource={document.getElementById('root') ?? undefined}
      eventPrefix="client"
      // Measure the layout size, not the transformed one: Home scales this canvas's container while docking,
      // and the canvas must not shrink a second time (or re-render at a new size every frame).
      resize={{ offsetSize: true }}
      aria-hidden="true"
    >
      <hemisphereLight args={[colors.ink.hex, colors.bg.hex, 0.55]} />
      <directionalLight position={[2.5, 3, 4]} intensity={1.6} />
      {/* Rim light: behind and above, in sage, so the edge glows softly against the background */}
      <directionalLight position={[-3, 2, -4]} intensity={2.4} color={colors.sage.hex} />
      <directionalLight position={[3, -2, -3]} intensity={1.1} color={colors.accent.hex} />
      <Form shape={shape} animate={animate} interactive={interactive} pulseKey={pulseKey} main={colors.accent.hex} soft={colors.sage.hex} />
    </Canvas>
  )
}
