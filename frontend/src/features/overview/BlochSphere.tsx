/**
 * Bloch sphere: latitude/longitude wireframe, X/Y/Z axes, |0⟩/|1⟩ poles and an
 * accent state vector whose tip sits at radius r = 1 − noise (exactly on the
 * surface when noiseless). θ springs toward the encoded value; φ slowly precesses.
 *
 * Coordinates: Bloch z → three.js +y (up), Bloch x → +z, Bloch y → +x.
 */
import { Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { useThemeColors, type RGBA } from '@/lib/useThemeColors'
import { SCENE_DPR, useDisposable, useSceneActivity } from '@/components/three/useSceneActivity'

const MERIDIANS = 8
const PARALLELS = 6
const SEGMENTS = 96
const PHI_START = 0.48
/** rad/s — one full precession every ~42 s. */
const PRECESSION_SPEED = 0.15
/** How quickly θ and r follow their targets (1/s); ~0.35 s to settle, no overshoot. */
const FOLLOW_RATE = 9

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

function Polyline({ points, color, opacity }: { points: THREE.Vector3[]; color: string; opacity: number }) {
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points])
  useDisposable(geometry)
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
    out.push(point(from + ((to - from) * i) / SEGMENTS), point(from + ((to - from) * (i + 1)) / SEGMENTS))
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
        <span className={`${labelClass} block translate-x-4 -translate-y-3 type-small`} style={{ color: ink.hex }}>|0⟩</span>
      </Html>
      <Html position={[0, -1.2, 0]} center zIndexRange={[10, 0]}>
        <span className={`${labelClass} block translate-x-4 translate-y-3 type-small`} style={{ color: ink.hex }}>|1⟩</span>
      </Html>
      <Html position={[0, 0, AXIS_LEN + 0.1]} center zIndexRange={[10, 0]}>
        <span className={`${labelClass} type-label`} style={{ color: muted.hex }}>X</span>
      </Html>
      <Html position={[AXIS_LEN + 0.1, 0, 0]} center zIndexRange={[10, 0]}>
        <span className={`${labelClass} type-label`} style={{ color: muted.hex }}>Y</span>
      </Html>
    </group>
  )
}

/** Live state shared between the vector, its projection and the caption. */
interface LiveState {
  theta: number
  phi: number
  r: number
}

interface StateVectorProps {
  accent: RGBA
  classical: RGBA
  targetTheta: number
  noise: number
  animate: boolean
  live: MutableRefObject<LiveState>
  onAngles: (theta: number, phi: number) => void
}

const UP = new THREE.Vector3(0, 1, 0)

/** The only writer of `live`: eases θ and r toward their targets, precesses φ, orients and scales the arrow. */
function StateVector({ accent, classical, targetTheta, noise, animate, live, onAngles }: StateVectorProps) {
  const group = useRef<THREE.Group>(null)
  const materials = useRef<THREE.MeshBasicMaterial[]>([])
  const lastReport = useRef(-1)
  const accentColor = useMemo(() => new THREE.Color(accent.hex), [accent.hex])
  const greyColor = useMemo(() => new THREE.Color(classical.hex), [classical.hex])
  const mixed = useMemo(() => new THREE.Color(), [])

  useFrame((state, delta) => {
    const s = live.current
    const targetR = 1 - noise
    if (animate) {
      const k = 1 - Math.exp(-delta * FOLLOW_RATE)
      s.theta += (targetTheta - s.theta) * k
      s.r += (targetR - s.r) * k
      s.phi = (s.phi + delta * PRECESSION_SPEED) % (Math.PI * 2)
    } else {
      s.theta = targetTheta
      s.r = targetR
    }

    const g = group.current
    if (g) {
      g.quaternion.setFromUnitVectors(UP, blochToVec(s.theta, s.phi))
      // Scale keeps the arrow's proportions; r = 1 puts the cone tip exactly on the surface.
      g.scale.setScalar(Math.max(s.r, 0.001))
    }
    // Fade from accent toward classical grey as noise rises.
    mixed.copy(accentColor).lerp(greyColor, Math.min(1, 1 - s.r))
    for (const m of materials.current) m.color.copy(mixed)

    if (state.clock.elapsedTime - lastReport.current > 0.1) {
      lastReport.current = state.clock.elapsedTime
      onAngles(s.theta, s.phi)
    }
  })

  const register = (index: number) => (m: THREE.MeshBasicMaterial | null) => {
    if (m) materials.current[index] = m
  }

  // Modelled along +y: shaft 0 → 1−h, cone from 1−h to a tip at exactly 1.0.
  const shaftLength = 1 - CONE_HEIGHT
  return (
    <group ref={group}>
      <mesh position={[0, shaftLength / 2, 0]}>
        <cylinderGeometry args={[SHAFT_RADIUS, SHAFT_RADIUS, shaftLength, 12]} />
        <meshBasicMaterial ref={register(0)} color={accent.hex} />
      </mesh>
      <mesh position={[0, 1 - CONE_HEIGHT / 2, 0]}>
        <coneGeometry args={[CONE_RADIUS, CONE_HEIGHT, 24]} />
        <meshBasicMaterial ref={register(1)} color={accent.hex} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshBasicMaterial ref={register(2)} color={accent.hex} />
      </mesh>
    </group>
  )
}

/** Dashed drop-line from the vector tip to the equatorial plane — helps read φ. */
function Projection({ accent, live }: { accent: RGBA; live: MutableRefObject<LiveState> }) {
  const line = useRef<THREE.LineSegments>(null)
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), [])
  useDisposable(geometry)
  useFrame(() => {
    const { theta, phi, r } = live.current
    const tip = blochToVec(theta, phi).multiplyScalar(r)
    const pos = geometry.attributes.position as THREE.BufferAttribute
    pos.setXYZ(0, tip.x, tip.y, tip.z)
    pos.setXYZ(1, tip.x, 0, tip.z)
    pos.needsUpdate = true
    line.current?.computeLineDistances()
  })
  return (
    <lineSegments ref={line} geometry={geometry}>
      <lineDashedMaterial color={accent.hex} dashSize={0.03} gapSize={0.03} transparent opacity={0.5} />
    </lineSegments>
  )
}

export interface BlochSphereProps {
  /** Polar angle the vector should move to (radians, 0 = |0⟩, π = |1⟩). */
  theta: number
  /** 0–1. Bloch vector length is 1 − noise. */
  noise: number
  /** Receives the live (animated) angles, throttled, for the caption. */
  onAngles: (theta: number, phi: number) => void
}

export default function BlochSphere({ theta, noise, onAngles }: BlochSphereProps) {
  const scene = useSceneActivity<HTMLCanvasElement>()
  const colors = useThemeColors()
  const reduced = useReducedMotion() ?? false
  const live = useRef<LiveState>({ theta, phi: PHI_START, r: 1 - noise })

  return (
    <Canvas
      ref={scene.ref}
      dpr={SCENE_DPR}
      frameloop={scene.active ? 'always' : 'never'}
      camera={{ position: CAMERA_POSITION, fov: 32, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true }}
      aria-label="Interactive Bloch sphere showing one qubit"
      role="img"
      style={{ touchAction: 'none' }}
    >
      <Wireframe ink={colors.ink} />
      <Axes ink={colors.ink} muted={colors.muted} />
      <StateVector
        accent={colors.accent}
        classical={colors.classical}
        targetTheta={theta}
        noise={noise}
        animate={!reduced}
        live={live}
        onAngles={onAngles}
      />
      <Projection accent={colors.accent} live={live} />
      <OrbitControls enableZoom={false} enablePan={false} rotateSpeed={0.6} enableDamping dampingFactor={0.08} />
    </Canvas>
  )
}
