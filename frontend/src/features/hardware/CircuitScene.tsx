/**
 * 3D view of the QSVM's circuit: the 4-qubit ZZ feature map, two repetitions,
 * then measurement. Qubits are thin rods, single-qubit gates flat accent
 * blocks, CNOTs a control dot + target ring joined by a connector.
 * Noise shows up two ways: gates jitter in proportion to their own error rate
 * (skipped under reduced motion) and fade toward grey; rods fade as T2 shortens.
 */
import { Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useThemeColors } from '@/lib/useThemeColors'
import type { NoiseParams } from '@/types'

const QUBITS = 4
const REPS = 2
const COL = 0.34
const ROW = 0.62

type Op =
  | { kind: '1q'; q: number; col: number }
  | { kind: 'cx'; control: number; target: number; col: number }
  | { kind: 'measure'; q: number; col: number }

/** ZZ feature map: H, RZ(x), then CX · RZ · CX on each neighbouring pair; repeated; then measure. */
function buildOps(): { ops: Op[]; cols: number } {
  const ops: Op[] = []
  let col = 0
  for (let r = 0; r < REPS; r++) {
    for (const _layer of ['H', 'RZ']) {
      for (let q = 0; q < QUBITS; q++) ops.push({ kind: '1q', q, col })
      col++
    }
    for (let i = 0; i < QUBITS - 1; i++) {
      ops.push({ kind: 'cx', control: i, target: i + 1, col: col++ })
      ops.push({ kind: '1q', q: i + 1, col: col++ })
      ops.push({ kind: 'cx', control: i, target: i + 1, col: col++ })
    }
  }
  for (let q = 0; q < QUBITS; q++) ops.push({ kind: 'measure', q, col })
  return { ops, cols: col + 1 }
}

const MEASURE_BOX = new THREE.BoxGeometry(0.24, 0.24, 0.06)

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const yOf = (q: number) => ((QUBITS - 1) / 2 - q) * ROW

interface Levels {
  e1: number
  e2: number
  readout: number
  /** 0 (short T2) … 1 (long or ideal). */
  coherence: number
}

function levels(noise: NoiseParams): Levels {
  return {
    e1: clamp01(noise.gateError1q / 0.2),
    e2: clamp01(noise.gateError2q / 3),
    readout: clamp01(noise.readoutError / 5),
    coherence: noise.t2Us === null ? 1 : clamp01(noise.t2Us / 250),
  }
}

function Circuit({ noise, animate }: { noise: NoiseParams; animate: boolean }) {
  const colors = useThemeColors()
  const { ops, cols } = useMemo(buildOps, [])
  const lv = levels(noise)
  const xOf = (col: number) => (col - (cols - 1) / 2) * COL
  const length = cols * COL + 0.5
  const groups = useRef<(THREE.Group | null)[]>([])

  // Gates fade from accent toward grey with overall noise.
  const gateColor = useMemo(() => {
    const mix = clamp01(0.55 * lv.e2 + 0.3 * lv.e1 + 0.15 * lv.readout)
    return new THREE.Color(colors.accent.hex).lerp(new THREE.Color(colors.classical.hex), mix * 0.8).getStyle()
  }, [colors.accent.hex, colors.classical.hex, lv.e1, lv.e2, lv.readout])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    ops.forEach((op, i) => {
      const g = groups.current[i]
      if (!g) return
      const amp = !animate ? 0 : op.kind === 'cx' ? lv.e2 * 0.07 : op.kind === 'measure' ? lv.readout * 0.05 : lv.e1 * 0.04
      g.position.x = amp * Math.sin(t * (7 + (i % 5)) + i)
      g.position.y = amp * Math.cos(t * (9 + (i % 3)) + i * 1.7)
    })
  })

  const ink = colors.ink.hex
  const rodOpacity = 0.2 + 0.5 * lv.coherence

  return (
    <group>
      {Array.from({ length: QUBITS }, (_, q) => (
        <group key={q} position={[0, yOf(q), 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, length, 8]} />
            <meshBasicMaterial color={ink} transparent opacity={rodOpacity} />
          </mesh>
          <Html position={[-length / 2 - 0.25, 0, 0]} center zIndexRange={[10, 0]}>
            <span className="pointer-events-none font-mono whitespace-nowrap type-small" style={{ color: colors.muted.hex }}>
              q{q}
            </span>
          </Html>
        </group>
      ))}

      {ops.map((op, i) => (
        <group
          key={i}
          ref={(g) => {
            groups.current[i] = g
          }}
        >
          <group position={[xOf(op.col), 0, 0]}>
            {op.kind === '1q' && (
              <mesh position={[0, yOf(op.q), 0]}>
                <boxGeometry args={[0.2, 0.2, 0.05]} />
                <meshBasicMaterial color={gateColor} />
              </mesh>
            )}
            {op.kind === 'cx' && (
              <>
                <mesh position={[0, yOf(op.control), 0]}>
                  <sphereGeometry args={[0.055, 16, 16]} />
                  <meshBasicMaterial color={gateColor} />
                </mesh>
                <mesh position={[0, yOf(op.target), 0]}>
                  <torusGeometry args={[0.1, 0.014, 8, 32]} />
                  <meshBasicMaterial color={gateColor} />
                </mesh>
                <mesh position={[0, (yOf(op.control) + yOf(op.target)) / 2, 0]}>
                  <cylinderGeometry args={[0.01, 0.01, Math.abs(yOf(op.control) - yOf(op.target)) + 0.1, 6]} />
                  <meshBasicMaterial color={gateColor} />
                </mesh>
              </>
            )}
            {op.kind === 'measure' && (
              <lineSegments position={[0, yOf(op.q), 0]}>
                <edgesGeometry args={[MEASURE_BOX]} />
                <lineBasicMaterial color={ink} />
              </lineSegments>
            )}
          </group>
        </group>
      ))}
    </group>
  )
}

const FOV = 34
/** Half the circuit's width plus room for the qubit labels, in scene units. */
const HALF_WIDTH = 4.75

/** Keeps the whole circuit in frame at any container aspect (narrow columns, projector mode). */
function FitCamera() {
  const { camera, size } = useThree()
  useFrame(() => {
    const aspect = size.width / Math.max(size.height, 1)
    const hfov = 2 * Math.atan(Math.tan(((FOV / 2) * Math.PI) / 180) * aspect)
    const distance = Math.max(8.5, HALF_WIDTH / Math.tan(hfov / 2))
    const dir = camera.position.clone().normalize()
    if (Math.abs(camera.position.length() - distance) > 0.01) camera.position.copy(dir.multiplyScalar(distance))
  })
  return null
}

export default function CircuitScene({ noise }: { noise: NoiseParams }) {
  const reduced = useReducedMotion() ?? false
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0.8, 1.4, 10.8], fov: FOV, near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: true }}
      role="img"
      aria-label="3D view of the 4-qubit ZZ feature-map circuit; gates shake as hardware noise increases"
      style={{ touchAction: 'none' }}
    >
      <FitCamera />
      <Circuit noise={noise} animate={!reduced} />
      <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.5} enableDamping dampingFactor={0.08} />
    </Canvas>
  )
}
