/**
 * Failure envelope in 3D: x = two-qubit gate error, z = data corruption,
 * y = sensitivity. Each tile is one flat risk colour (no gradients) taken from
 * the WORST of its four measured corners — a deliberately conservative choice.
 * A translucent accent plane marks the safety threshold; "you are here" marks
 * FakeBackend-1.
 */
import { Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SAFETY_RANK, safetyStatus } from '@/lib/safety'
import { useThemeColors } from '@/lib/useThemeColors'
import type { FailureEnvelopeSweep, SafetyStatus } from '@/types'

const SIZE = 4
const HEIGHT = 2.2

interface SceneProps {
  sweep: FailureEnvelopeSweep
  threshold: number
}

function useScales(sweep: FailureEnvelopeSweep) {
  return useMemo(() => {
    const all = sweep.sensitivity.flat()
    const lo = Math.floor(Math.min(...all, sweep.threshold) * 20) / 20
    const hi = Math.ceil(Math.max(...all, sweep.threshold) * 20) / 20
    const nx = sweep.noiseAxis.values.length
    const nz = sweep.corruptionAxis.values.length
    const noiseMax = sweep.noiseAxis.values[nx - 1]
    const corrMax = sweep.corruptionAxis.values[nz - 1]
    return {
      lo,
      hi,
      x: (noise: number) => (noise / noiseMax - 0.5) * SIZE,
      // Corruption 0 at the front edge.
      z: (corr: number) => (0.5 - corr / corrMax) * SIZE,
      y: (s: number) => ((s - lo) / (hi - lo)) * HEIGHT,
      xi: (i: number) => (i / (nx - 1) - 0.5) * SIZE,
      zj: (j: number) => (0.5 - j / (nz - 1)) * SIZE,
    }
  }, [sweep])
}

function Surface({ sweep, threshold }: SceneProps) {
  const colors = useThemeColors()
  const s = useScales(sweep)
  const { geometry, lines } = useMemo(() => {
    const status = (j: number, i: number): SafetyStatus => safetyStatus(sweep.sensitivity[j][i], sweep.sensitivityStd[j][i], threshold)
    const colorOf: Record<SafetyStatus, THREE.Color> = {
      safe: new THREE.Color(colors.riskLow.hex),
      borderline: new THREE.Color(colors.riskMid.hex),
      unsafe: new THREE.Color(colors.riskHigh.hex),
    }
    const positions: number[] = []
    const cols: number[] = []
    const nz = sweep.sensitivity.length
    const nx = sweep.sensitivity[0].length
    const v = (j: number, i: number) => [s.xi(i), s.y(sweep.sensitivity[j][i]), s.zj(j)]
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const corners: [number, number][] = [[j, i], [j, i + 1], [j + 1, i], [j + 1, i + 1]]
        const worst = corners.map(([a, b]) => status(a, b)).reduce((a, b) => (SAFETY_RANK[b] < SAFETY_RANK[a] ? b : a))
        const c = colorOf[worst]
        const [p00, p01, p10, p11] = corners.map(([a, b]) => v(a, b))
        for (const p of [p00, p01, p11, p00, p11, p10]) {
          positions.push(...p)
          cols.push(c.r, c.g, c.b)
        }
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))

    // Grid lines along both axes, following the surface.
    const l: number[] = []
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx - 1; i++) l.push(...v(j, i), ...v(j, i + 1))
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz - 1; j++) l.push(...v(j, i), ...v(j + 1, i))
    const lg = new THREE.BufferGeometry()
    lg.setAttribute('position', new THREE.Float32BufferAttribute(l, 3))
    return { geometry: g, lines: lg }
  }, [sweep, threshold, s, colors.riskLow.hex, colors.riskMid.hex, colors.riskHigh.hex])

  return (
    <group>
      <mesh geometry={geometry}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} transparent opacity={0.88} />
      </mesh>
      <lineSegments geometry={lines}>
        <lineBasicMaterial color={colors.bg.hex} transparent opacity={0.55} />
      </lineSegments>
    </group>
  )
}

function ThresholdPlane({ sweep, threshold, animate }: SceneProps & { animate: boolean }) {
  const colors = useThemeColors()
  const s = useScales(sweep)
  const group = useRef<THREE.Group>(null)
  const target = s.y(threshold)
  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    g.position.y = animate ? g.position.y + (target - g.position.y) * (1 - Math.exp(-delta * 9)) : target
  })
  const edge = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(SIZE, SIZE)), [])
  return (
    <group ref={group} position={[0, target, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshBasicMaterial color={colors.accent.hex} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edge} rotation={[-Math.PI / 2, 0, 0]}>
        <lineBasicMaterial color={colors.accent.hex} />
      </lineSegments>
      <Html position={[-SIZE / 2, 0.12, -SIZE / 2]} center zIndexRange={[10, 0]}>
        <span className="pointer-events-none font-mono whitespace-nowrap type-small rounded-[2px] px-1" style={{ color: colors.accent.hex, background: colors.bg.hex }}>
          {(threshold * 100).toFixed(1)}% threshold
        </span>
      </Html>
    </group>
  )
}

function Axes({ sweep }: { sweep: FailureEnvelopeSweep }) {
  const colors = useThemeColors()
  const s = useScales(sweep)
  const label = 'pointer-events-none font-mono whitespace-nowrap type-small'
  const box = useMemo(() => {
    const h = SIZE / 2
    const pts = [
      [-h, 0, h], [h, 0, h], [-h, 0, h], [-h, 0, -h], [-h, 0, -h], [h, 0, -h], [h, 0, -h], [h, 0, h], // floor
      [-h - 0.35, 0, h + 0.35], [-h - 0.35, HEIGHT, h + 0.35], // y axis post, outside the surface
      [-h, 0, h], [-h - 0.35, 0, h + 0.35],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z))
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [])
  const yTicks = [s.lo, (s.lo + s.hi) / 2, s.hi]
  return (
    <group>
      <lineSegments geometry={box}>
        <lineBasicMaterial color={colors.ink.hex} transparent opacity={0.45} />
      </lineSegments>
      {[0, 1, 2, 3].map((n) => (
        <Html key={`x${n}`} position={[s.x(n), 0, SIZE / 2 + 0.3]} center zIndexRange={[10, 0]}>
          <span className={label} style={{ color: colors.muted.hex }}>{n}%</span>
        </Html>
      ))}
      {yTicks.map((v) => (
        <Html key={`y${v}`} position={[-SIZE / 2 - 0.75, s.y(v), SIZE / 2 + 0.35]} center zIndexRange={[10, 0]}>
          <span className={label} style={{ color: colors.muted.hex }}>{Math.round(v * 100)}%</span>
        </Html>
      ))}
      <Html position={[-SIZE / 2 - 0.35, HEIGHT + 0.3, SIZE / 2 + 0.35]} center zIndexRange={[10, 0]}>
        <span className={label} style={{ color: colors.ink.hex }}>sensitivity</span>
      </Html>
    </group>
  )
}

function YouAreHere({ sweep }: { sweep: FailureEnvelopeSweep }) {
  const colors = useThemeColors()
  const s = useScales(sweep)
  const { noise, corruption, sensitivity, profileName } = sweep.current
  const x = s.x(noise)
  const z = s.z(corruption)
  const y = s.y(sensitivity)
  const drop = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, z), new THREE.Vector3(x, y, z)]), [x, y, z])
  return (
    <group>
      <lineSegments geometry={drop}>
        <lineBasicMaterial color={colors.ink.hex} />
      </lineSegments>
      <mesh position={[x, y, z]}>
        <sphereGeometry args={[0.07, 20, 20]} />
        <meshBasicMaterial color={colors.ink.hex} />
      </mesh>
      <Html position={[x, y, z]} zIndexRange={[20, 0]}>
        <span
          className="pointer-events-none block font-mono whitespace-nowrap type-small rounded-[2px] px-1.5 py-0.5"
          style={{ color: colors.bg.hex, background: colors.ink.hex, transform: 'translate(14px, -50%)' }}
        >
          You are here · {profileName} · {(sensitivity * 100).toFixed(1)}%
        </span>
      </Html>
    </group>
  )
}

export default function SurfaceScene({ sweep, threshold }: SceneProps) {
  const reduced = useReducedMotion() ?? false
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [6.4, 4.6, 7.6], fov: 34, near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: true }}
      role="img"
      aria-label="3D failure envelope: sensitivity across hardware noise and data corruption, coloured safe, borderline or unsafe"
      style={{ touchAction: 'none' }}
    >
      <group position={[0, -0.7, 0]}>
        <Surface sweep={sweep} threshold={threshold} />
        <ThresholdPlane sweep={sweep} threshold={threshold} animate={!reduced} />
        <Axes sweep={sweep} />
        <YouAreHere sweep={sweep} />
      </group>
      <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.5} enableDamping dampingFactor={0.08} target={[0, -0.35, 0]} />
    </Canvas>
  )
}
