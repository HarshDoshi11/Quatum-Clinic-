/**
 * Failure envelope in 3D: x = two-qubit gate error, z = corrupted patient values,
 * y = sensitivity. Each tile is one flat risk colour (no gradients) taken from
 * the WORST of its four measured corners — a deliberately conservative choice.
 *
 * Labels are DOM overlays (drei <Html>), so they always face the viewer and use
 * the type scale. Rotation is bounded to the front quadrant (never edge-on to an
 * axis, never from below or straight above), and every label family sits on its
 * own side of the plot:
 *   - sensitivity ticks: screen-left of the post at the leftmost floor corner
 *   - gate-error ticks: outside the front-left floor edge
 *   - corruption ticks: outside the front-right floor edge
 *   - threshold label: screen-right of the rightmost plane corner
 * so they stay readable and apart at every allowed angle.
 */
import { Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SAFETY_RANK, safetyStatus } from '@/lib/safety'
import { useThemeColors } from '@/lib/useThemeColors'
import type { EnvelopeProfile, FailureEnvelopeSweep, SafetyStatus } from '@/types'
import { formatPercent } from '@/lib/format'

const SIZE = 4
const H = SIZE / 2
const HEIGHT = 2.2
/** Floor sits a little below the lowest tick, so the bottom tick clears the floor labels. */
const FLOOR_PAD = 0.1
const deg = (d: number) => (d * Math.PI) / 180

/** Floor tick labels: outward from their edge and slightly below the floor. */
const TICK_OUT = 0.4
const TICK_DROP = -0.12
const TITLE_GAP_PX = 10

const TICK = 'pointer-events-none block select-none font-mono whitespace-nowrap type-small'
const TITLE = 'pointer-events-none block select-none whitespace-nowrap type-label'

interface SceneProps {
  sweep: FailureEnvelopeSweep
  profile: EnvelopeProfile
  threshold: number
}

function useScales(sweep: FailureEnvelopeSweep, profile: EnvelopeProfile, threshold: number) {
  return useMemo(() => {
    const all = profile.sensitivity.flat()
    // Round 10-point ticks (60, 70, 80, 90, 100%).
    const lo = Math.floor(Math.min(...all, threshold) * 10) / 10
    const hi = Math.min(1, Math.ceil(Math.max(...all, threshold) * 10) / 10)
    const nx = sweep.noiseAxis.values.length
    const nz = sweep.corruptionAxis.values.length
    const noiseMax = sweep.noiseAxis.values[nx - 1]
    const corrMax = sweep.corruptionAxis.values[nz - 1]
    const yTicks: number[] = []
    for (let v = lo; v <= hi + 1e-9; v += 0.1) yTicks.push(Math.round(v * 10) / 10)
    const floor = lo - FLOOR_PAD
    return {
      yTicks,
      x: (noise: number) => (noise / noiseMax - 0.5) * SIZE,
      // Corruption 0 at the front (+z) edge.
      z: (corr: number) => (0.5 - corr / corrMax) * SIZE,
      y: (s: number) => ((s - floor) / (hi - floor)) * HEIGHT,
      xi: (i: number) => (i / (nx - 1) - 0.5) * SIZE,
      zj: (j: number) => (0.5 - j / (nz - 1)) * SIZE,
    }
  }, [sweep, profile, threshold])
}

type Scales = ReturnType<typeof useScales>

function Surface({ profile, threshold, s }: { profile: EnvelopeProfile; threshold: number; s: Scales }) {
  const colors = useThemeColors()
  const { geometry, lines } = useMemo(() => {
    const status = (j: number, i: number): SafetyStatus => safetyStatus(profile.sensitivity[j][i], profile.sensitivityStd[j][i], threshold)
    const colorOf: Record<SafetyStatus, THREE.Color> = {
      safe: new THREE.Color(colors.riskLow.hex),
      borderline: new THREE.Color(colors.riskMid.hex),
      unsafe: new THREE.Color(colors.riskHigh.hex),
    }
    const positions: number[] = []
    const cols: number[] = []
    const nz = profile.sensitivity.length
    const nx = profile.sensitivity[0].length
    const v = (j: number, i: number) => [s.xi(i), s.y(profile.sensitivity[j][i]), s.zj(j)]
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
    const l: number[] = []
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx - 1; i++) l.push(...v(j, i), ...v(j, i + 1))
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz - 1; j++) l.push(...v(j, i), ...v(j + 1, i))
    const lg = new THREE.BufferGeometry()
    lg.setAttribute('position', new THREE.Float32BufferAttribute(l, 3))
    return { geometry: g, lines: lg }
  }, [profile, threshold, s, colors.riskLow.hex, colors.riskMid.hex, colors.riskHigh.hex])

  return (
    <group>
      <mesh geometry={geometry}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} transparent opacity={0.9} />
      </mesh>
      <lineSegments geometry={lines}>
        <lineBasicMaterial color={colors.bg.hex} transparent opacity={0.5} />
      </lineSegments>
    </group>
  )
}

function ThresholdPlane({ threshold, s, animate }: { threshold: number; s: Scales; animate: boolean }) {
  const colors = useThemeColors()
  const group = useRef<THREE.Group>(null)
  const target = s.y(threshold)
  useFrame((_, delta) => {
    const g = group.current
    if (g) g.position.y = animate ? g.position.y + (target - g.position.y) * (1 - Math.exp(-delta * 9)) : target
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
      {/* Right of the rightmost plane corner (+x, −z): nothing else lives there. */}
      <Html position={[H, 0, -H]} zIndexRange={[10, 0]}>
        <span className={`${TICK} rounded-[2px] px-1`} style={{ color: colors.accent.hex, background: colors.bg.hex, transform: 'translate(0.625rem, -50%)' }}>
          {formatPercent(threshold)} threshold
        </span>
      </Html>
    </group>
  )
}

function Axes({ sweep, s }: { sweep: FailureEnvelopeSweep; s: Scales }) {
  const colors = useThemeColors()
  const noiseTicks = useMemo(() => sweep.noiseAxis.values.filter((v) => Number.isInteger(v)), [sweep]) // 0, 1, 2, 3 %
  const corrTicks = useMemo(() => sweep.corruptionAxis.values.filter((v) => v % 10 === 0), [sweep]) // 0, 10, 20, 30 %
  // Floor outline + vertical post at the leftmost corner (0% gate error, 0% corruption).
  const frame = useMemo(() => {
    const pts = [
      [-H, 0, H], [H, 0, H], [H, 0, H], [H, 0, -H], [H, 0, -H], [-H, 0, -H], [-H, 0, -H], [-H, 0, H],
      [-H, 0, H], [-H, HEIGHT, H],
      ...s.yTicks.flatMap((v) => [[-H, s.y(v), H], [-H - 0.07, s.y(v), H + 0.07]]),
      // Floor tick marks tie the floor labels to their edges.
      ...noiseTicks.flatMap((n) => [[s.x(n), 0, H], [s.x(n), 0, H + 0.14]]),
      ...corrTicks.flatMap((c) => [[H, 0, s.z(c)], [H + 0.14, 0, s.z(c)]]),
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z))
    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [s, noiseTicks, corrTicks])

  // Floor axes: tick anchors sit just outside their edge; the title is placed per frame (below).
  const floorAxes = useMemo(
    () => [
      {
        key: 'x',
        title: 'Two-qubit gate error',
        edge: [new THREE.Vector3(-H, 0, H), new THREE.Vector3(H, 0, H)] as const,
        ticks: noiseTicks.map((n) => ({ label: `${n}%`, at: new THREE.Vector3(s.x(n), TICK_DROP, H + TICK_OUT) })),
      },
      {
        key: 'z',
        title: 'Corrupted patient values',
        edge: [new THREE.Vector3(H, 0, H), new THREE.Vector3(H, 0, -H)] as const,
        ticks: corrTicks.map((c) => ({ label: `${c}%`, at: new THREE.Vector3(H + TICK_OUT, TICK_DROP, s.z(c)) })),
      },
    ],
    [s, noiseTicks, corrTicks],
  )
  const root = useRef<THREE.Group>(null)
  const tickEls = useRef<Record<string, HTMLSpanElement | null>>({})
  const titleEls = useRef<Record<string, HTMLSpanElement | null>>({})

  // Each frame, push every floor-axis title along its edge's on-screen outward normal until it
  // clears all of that axis's tick labels. Titles therefore never touch their ticks, even when
  // the axis is steeply foreshortened.
  useFrame(({ camera, size }) => {
    const g = root.current
    if (!g) return
    const px = (p: THREE.Vector3) => {
      const v = g.localToWorld(p.clone()).project(camera)
      return new THREE.Vector2(((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height)
    }
    const centre = px(new THREE.Vector3(0, 0, 0))
    for (const ax of floorAxes) {
      const title = titleEls.current[ax.key]
      if (!title) continue
      const a = px(ax.edge[0])
      const b = px(ax.edge[1])
      const mid = a.clone().add(b).multiplyScalar(0.5)
      const dir = b.clone().sub(a).normalize()
      const n = new THREE.Vector2(-dir.y, dir.x)
      if (n.dot(mid.clone().sub(centre)) < 0) n.negate()
      const along = (el: HTMLElement) => (Math.abs(n.x) * el.offsetWidth + Math.abs(n.y) * el.offsetHeight) / 2
      let reach = 0
      ax.ticks.forEach((t, i) => {
        const el = tickEls.current[`${ax.key}${i}`]
        if (el) reach = Math.max(reach, px(t.at).sub(mid).dot(n) + along(el))
      })
      const d = reach + TITLE_GAP_PX + along(title)
      // Keep the whole title inside the canvas.
      const hw = title.offsetWidth / 2 + TITLE_GAP_PX
      const hh = title.offsetHeight / 2 + TITLE_GAP_PX
      const cx = THREE.MathUtils.clamp(mid.x + n.x * d, hw, size.width - hw)
      const cy = THREE.MathUtils.clamp(mid.y + n.y * d, hh, size.height - hh)
      title.style.transform = `translate(${(cx - mid.x).toFixed(1)}px, ${(cy - mid.y).toFixed(1)}px)`
    }
  })

  return (
    <group ref={root}>
      <lineSegments geometry={frame}>
        <lineBasicMaterial color={colors.ink.hex} transparent opacity={0.5} />
      </lineSegments>

      {/* Gate error (front-left edge) and corruption (front-right edge) */}
      {floorAxes.map((ax) => (
        <group key={ax.key}>
          {ax.ticks.map((t, i) => (
            <Html key={t.label} position={t.at} center zIndexRange={[10, 0]}>
              <span
                ref={(el) => {
                  tickEls.current[`${ax.key}${i}`] = el
                }}
                className={TICK}
                style={{ color: colors.muted.hex }}
              >
                {t.label}
              </span>
            </Html>
          ))}
          <Html position={ax.edge[0].clone().add(ax.edge[1]).multiplyScalar(0.5)} center zIndexRange={[10, 0]}>
            <span
              ref={(el) => {
                titleEls.current[ax.key] = el
              }}
              className={TITLE}
              style={{ color: colors.ink.hex }}
            >
              {ax.title}
            </span>
          </Html>
        </group>
      ))}

      {/* Sensitivity — right-aligned to the screen-left of the post; title centred above it */}
      {s.yTicks.map((v) => (
        <Html key={`y${v}`} position={[-H, s.y(v), H]} zIndexRange={[10, 0]}>
          <span className={TICK} style={{ color: colors.muted.hex, transform: 'translate(calc(-100% - 0.75rem), -50%)' }}>
            {Math.round(v * 100)}%
          </span>
        </Html>
      ))}
      <Html position={[-H, HEIGHT, H]} zIndexRange={[10, 0]}>
        <span className={TITLE} style={{ color: colors.ink.hex, transform: 'translate(-50%, calc(-100% - 1rem))' }}>
          Sensitivity
        </span>
      </Html>
    </group>
  )
}

function YouAreHere({ profile, s }: { profile: EnvelopeProfile; s: Scales }) {
  const colors = useThemeColors()
  const { noise, corruption, sensitivity } = profile.current
  // True coordinates: the backend's own 2Q error and 0% corruption; height = its stored sensitivity,
  // which is exactly the surface height there (the grid holds the same store values).
  const x = s.x(noise)
  const z = s.z(corruption)
  const y = s.y(sensitivity)
  const stem = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, z), new THREE.Vector3(x, y, z)]), [x, y, z])
  return (
    <group>
      <lineSegments geometry={stem}>
        <lineBasicMaterial color={colors.ink.hex} />
      </lineSegments>
      <mesh position={[x, y, z]}>
        <sphereGeometry args={[0.07, 20, 20]} />
        <meshBasicMaterial color={colors.ink.hex} />
      </mesh>
      <Html position={[x, y, z]} zIndexRange={[20, 0]}>
        <span className={`${TICK} rounded-[2px] px-1.5 py-0.5`} style={{ color: colors.bg.hex, background: colors.ink.hex, transform: 'translate(0.75rem, -130%)' }}>
          You are here · {formatPercent(sensitivity)}
        </span>
      </Html>
    </group>
  )
}

function Scene({ sweep, profile, threshold, animate }: SceneProps & { animate: boolean }) {
  const s = useScales(sweep, profile, threshold)
  return (
    <group position={[0, -0.7, 0]}>
      <Surface profile={profile} threshold={threshold} s={s} />
      <ThresholdPlane threshold={threshold} s={s} animate={animate} />
      <Axes sweep={sweep} s={s} />
      <YouAreHere profile={profile} s={s} />
    </group>
  )
}

export default function SurfaceScene({ sweep, profile, threshold }: SceneProps) {
  const reduced = useReducedMotion() ?? false
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [6.6, 4.8, 7.8], fov: 40, near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: true }}
      role="img"
      aria-label={`3D failure envelope for ${profile.profileName}: sensitivity across two-qubit gate error and corrupted patient values, coloured safe, borderline or unsafe`}
      style={{ touchAction: 'none' }}
    >
      <Scene sweep={sweep} profile={profile} threshold={threshold} animate={!reduced} />
      {/* Front quadrant only: never edge-on to an axis, never from below or straight above. */}
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        rotateSpeed={0.5}
        enableDamping
        dampingFactor={0.08}
        target={[0, -0.25, 0]}
        minAzimuthAngle={deg(22)}
        maxAzimuthAngle={deg(60)}
        minPolarAngle={deg(54)}
        maxPolarAngle={deg(74)}
      />
    </Canvas>
  )
}
