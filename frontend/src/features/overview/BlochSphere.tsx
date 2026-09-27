/**
 * Bloch sphere: latitude/longitude wireframe, X/Y/Z axes, |0⟩/|1⟩ poles and an
 * accent state vector that ends exactly on the unit sphere and slowly precesses.
 *
 * Coordinates: Bloch z → three.js +y (up), Bloch x → +z (toward viewer), Bloch y → +x.
 */
import { Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { useThemeColors, type RGBA } from '@/lib/useThemeColors'

const MERIDIANS = 8
const PARALLELS = 6
const SEGMENTS = 96
const THETA = 1.12
const PHI_START = 0.48
/** rad/s — one full precession every ~42 s. */
const PRECESSION_SPEED = 0.15

/**
 * Camera sits a quarter-turn from the vector's starting azimuth, slightly above
 * the equator, so the vector starts broadside rather than pointing at the viewer.
 */
const CAMERA_DISTANCE = 5.4
const CAMERA_AZIMUTH = PHI_START - Math.PI / 2
const CAMERA_ELEVATION = 0.32
const CAMERA_POSITION: [number, number, number] = [
  CAMERA_DISTANCE * Math.cos(CAMERA_ELEVATION) * Math.sin(CAMERA_AZIMUTH),
  CAMERA_DISTANCE * Math.sin(CAMERA_ELEVATION),
  CAMERA_DISTANCE * Math.cos(CAMERA_ELEVATION) * Math.cos(CAMERA_AZIMUTH),
]

const CONE_HEIGHT = 0.1
const CONE_RADIUS = 0.035
const SHAFT_RADIUS = 0.008

/** Bloch (θ, φ) → three.js unit vector. */
function blochToVec(theta: number, phi: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi))
}

function useLineGeometry(points: THREE.Vector3[]): THREE.BufferGeometry {
  return useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points])
}

function Polyline({ points, color, opacity }: { points: THREE.Vector3[]; color: string; opacity: number }) {
  const geometry = useLineGeometry(points)
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </lineSegments>
  )
}

/** Circle points as segment pairs (for lineSegments). */
function circleSegments(point: (t: number) => THREE.Vector3, from = 0, to = Math.PI * 2): THREE.Vector3[] {
  const out: THREE.Vector3[] = []
  for (let i = 0; i < SEGMENTS; i++) {
    const a = from + ((to - from) * i) / SEGMENTS
    const b = from + ((to - from) * (i + 1)) / SEGMENTS
    out.push(point(a), point(b))
  }
  return out
}

function Wireframe({ ink }: { ink: RGBA }) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = []
    // Meridians: half great-circles from pole to pole, every 360/8 degrees.
    for (let m = 0; m < MERIDIANS; m++) {
      const phi = (m / MERIDIANS) * Math.PI * 2
      pts.push(...circleSegments((t) => blochToVec(t, phi), 0, Math.PI))
    }
    // Parallels: evenly spaced in polar angle, excluding the poles.
    for (let p = 1; p <= PARALLELS; p++) {
      const theta = (p / (PARALLELS + 1)) * Math.PI
      pts.push(...circleSegments((t) => blochToVec(theta, t)))
    }
    return pts
  }, [])
  return <Polyline points={points} color={ink.hex} opacity={0.22} />
}

const AXIS_LEN = 1.28

function Axes({ ink, muted }: { ink: RGBA; muted: RGBA }) {
  const points = useMemo(
    () => [
      new THREE.Vector3(0, -AXIS_LEN, 0), new THREE.Vector3(0, AXIS_LEN, 0), // Bloch z
      new THREE.Vector3(0, 0, -AXIS_LEN), new THREE.Vector3(0, 0, AXIS_LEN), // Bloch x
      new THREE.Vector3(-AXIS_LEN, 0, 0), new THREE.Vector3(AXIS_LEN, 0, 0), // Bloch y
    ],
    [],
  )
  const labelClass = 'pointer-events-none select-none font-mono whitespace-nowrap'
  return (
    <group>
      <Polyline points={points} color={ink.hex} opacity={0.55} />
      <Html position={[0, 1.2, 0]} center zIndexRange={[10, 0]}>
        <span className={`${labelClass} -translate-y-3 translate-x-4 block text-[13px]`} style={{ color: ink.hex }}>|0⟩</span>
      </Html>
      <Html position={[0, -1.2, 0]} center zIndexRange={[10, 0]}>
        <span className={`${labelClass} translate-y-3 translate-x-4 block text-[13px]`} style={{ color: ink.hex }}>|1⟩</span>
      </Html>
      <Html position={[0, 0, AXIS_LEN + 0.1]} center zIndexRange={[10, 0]}>
        <span className={`${labelClass} text-[10px]`} style={{ color: muted.hex }}>X</span>
      </Html>
      <Html position={[AXIS_LEN + 0.1, 0, 0]} center zIndexRange={[10, 0]}>
        <span className={`${labelClass} text-[10px]`} style={{ color: muted.hex }}>Y</span>
      </Html>
    </group>
  )
}

type PhiRef = MutableRefObject<number>

interface StateVectorProps {
  accent: RGBA
  animate: boolean
  phi: PhiRef
  onAngles: (theta: number, phi: number) => void
}

const UP = new THREE.Vector3(0, 1, 0)

/** Advances φ (the only writer of the shared ref) and orients the arrow. */
function StateVector({ accent, animate, phi, onAngles }: StateVectorProps) {
  const group = useRef<THREE.Group>(null)
  const lastReport = useRef(-1)

  useFrame((state, delta) => {
    if (animate) phi.current = (phi.current + delta * PRECESSION_SPEED) % (Math.PI * 2)
    group.current?.quaternion.setFromUnitVectors(UP, blochToVec(THETA, phi.current))
    // Update the caption ~10×/s rather than every frame.
    if (state.clock.elapsedTime - lastReport.current > 0.1) {
      lastReport.current = state.clock.elapsedTime
      onAngles(THETA, phi.current)
    }
  })

  // Modelled along +y: shaft 0 → 1−h, cone from 1−h to a tip at exactly 1.0 (the sphere surface).
  const shaftLength = 1 - CONE_HEIGHT
  return (
    <group ref={group}>
      <mesh position={[0, shaftLength / 2, 0]}>
        <cylinderGeometry args={[SHAFT_RADIUS, SHAFT_RADIUS, shaftLength, 12]} />
        <meshBasicMaterial color={accent.hex} />
      </mesh>
      <mesh position={[0, 1 - CONE_HEIGHT / 2, 0]}>
        <coneGeometry args={[CONE_RADIUS, CONE_HEIGHT, 24]} />
        <meshBasicMaterial color={accent.hex} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshBasicMaterial color={accent.hex} />
      </mesh>
    </group>
  )
}

/** Dashed drop-line from the state to the equatorial plane — helps read φ. Reads the shared φ. */
function Projection({ accent, phi }: { accent: RGBA; phi: PhiRef }) {
  const line = useRef<THREE.LineSegments>(null)
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), [])
  useFrame(() => {
    const tip = blochToVec(THETA, phi.current)
    const pos = geometry.attributes.position as THREE.BufferAttribute
    pos.setXYZ(0, tip.x, tip.y, tip.z)
    pos.setXYZ(1, tip.x, 0, tip.z)
    pos.needsUpdate = true
    line.current?.computeLineDistances()
  })
  return (
    <lineSegments ref={line} geometry={geometry}>
      <lineDashedMaterial color={accent.hex} dashSize={0.03} gapSize={0.03} transparent opacity={0.6} />
    </lineSegments>
  )
}

interface BlochSphereProps {
  /** Receives the live angles (throttled) for the caption. */
  onAngles: (theta: number, phi: number) => void
}

export default function BlochSphere({ onAngles }: BlochSphereProps) {
  const colors = useThemeColors()
  const reduced = useReducedMotion() ?? false
  const phi = useRef(PHI_START)

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: CAMERA_POSITION, fov: 32, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true }}
      aria-label="Interactive Bloch sphere showing a qubit state"
      role="img"
      style={{ touchAction: 'none' }}
    >
      <Wireframe ink={colors.ink} />
      <Axes ink={colors.ink} muted={colors.muted} />
      <StateVector accent={colors.accent} animate={!reduced} phi={phi} onAngles={onAngles} />
      <Projection accent={colors.accent} phi={phi} />
      <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.6} enableDamping dampingFactor={0.08} />
    </Canvas>
  )
}
