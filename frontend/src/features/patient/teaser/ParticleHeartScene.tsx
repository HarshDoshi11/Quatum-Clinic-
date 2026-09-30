import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useThemeColors } from '@/lib/useThemeColors'
import { useTheme } from '@/state/theme'
import { beatPhase, pulseScale } from '../heartbeat'
import { FORM_DELAY_MAX, makeHeartCloud, wireLinks } from './heartCloud'

const COUNT = 3000
/** Scattered → heart. */
const FORM_MS = 2500

const vertexShader = /* glsl */ `
  uniform float uProgress;
  uniform float uBeat;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uHover;
  uniform float uAspect;
  uniform float uSize;
  uniform float uFade;
  attribute vec3 aStart;
  attribute vec3 aDrift;
  attribute float aSettled;
  attribute float aDelay;
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Each point sets off after its delay and eases (in-out cubic) from the cloud onto the heart.
    float p = clamp((uProgress - aDelay) / (1.0 - ${FORM_DELAY_MAX.toFixed(2)}), 0.0, 1.0);
    float e = p < 0.5 ? 4.0 * p * p * p : 1.0 - pow(-2.0 * p + 2.0, 3.0) / 2.0;
    // Settled points take their place on the heart (and breathe with it); the others wait nearby, drifting slowly.
    vec3 waiting = aDrift + 0.09 * vec3(sin(uTime * 0.35 + aDelay * 37.0), cos(uTime * 0.28 + aDelay * 23.0), sin(uTime * 0.22 + aDelay * 29.0));
    vec3 home = aSettled > 0.5 ? position * uBeat : waiting;
    vec3 pos = mix(aStart, home, e);
    // While scattered, the cloud drifts a little.
    pos += (1.0 - e) * 0.06 * vec3(sin(uTime * 0.6 + aDelay * 40.0), cos(uTime * 0.5 + aDelay * 31.0), 0.0);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    // Near the cursor, points step aside a little; as it moves on they settle back.
    vec4 clip = projectionMatrix * mv;
    vec2 d = clip.xy / clip.w - uMouse;
    d.x *= uAspect;
    float dist = length(d);
    mv.xy += normalize(d + vec2(1e-5)) * uHover * smoothstep(0.26, 0.0, dist) * 0.12;

    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uSize * (aSettled > 0.5 ? 1.0 : 0.8) / -mv.z;
    vColor = aColor;
    vAlpha = (aSettled > 0.5 ? 0.45 + 0.4 * e : 0.3) * uFade;
  }
`

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    // A small soft round sprite.
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.05, r) * vAlpha);
  }
`

function Cloud({ animate, teal, coral, additive, settledFraction }: { animate: boolean; teal: string; coral: string; additive: boolean; settledFraction: number }) {
  const cloud = useMemo(() => makeHeartCloud(COUNT, settledFraction), [settledFraction])
  const wire = useRef<THREE.Group>(null)
  const lineMaterial = useRef<THREE.LineBasicMaterial>(null)
  const lineOpacity = additive ? 0.32 : 0.4
  const lines = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(wireLinks(cloud), 3))
    return g
  }, [cloud])
  useEffect(() => () => lines.dispose(), [lines])
  const group = useRef<THREE.Group>(null)
  const material = useRef<THREE.ShaderMaterial>(null)
  const began = useRef<number | null>(null)
  const pointer = useRef({ x: 0, y: 0, inside: false, clientX: -1e4, clientY: -1e4 })
  const { gl, size } = useThree()

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(cloud.target, 3))
    g.setAttribute('aStart', new THREE.BufferAttribute(cloud.start, 3))
    g.setAttribute('aDrift', new THREE.BufferAttribute(cloud.drift, 3))
    g.setAttribute('aSettled', new THREE.BufferAttribute(new Float32Array(cloud.settled), 1))
    g.setAttribute('aDelay', new THREE.BufferAttribute(cloud.delay, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(cloud.size, 1))
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3))
    return g
  }, [cloud])
  useEffect(() => () => geometry.dispose(), [geometry])

  // Teal points with a few coral ones, in the theme's colours.
  useEffect(() => {
    const attr = geometry.getAttribute('aColor') as THREE.BufferAttribute
    const a = new THREE.Color(teal)
    const b = new THREE.Color(coral)
    for (let i = 0; i < COUNT; i++) {
      const c = cloud.coral[i] ? b : a
      attr.setXYZ(i, c.r, c.g, c.b)
    }
    attr.needsUpdate = true
  }, [geometry, cloud, teal, coral])

  const uniforms = useMemo(
    () => ({
      uProgress: { value: animate ? 0 : 1 },
      uBeat: { value: 1 },
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(10, 10) },
      uHover: { value: 0 },
      uAspect: { value: 1 },
      uSize: { value: 30 },
      // Plain points on a light page read heavier than glowing ones on a dark page.
      uFade: { value: additive ? 1 : 0.75 },
    }),
    [animate, additive],
  )

  useEffect(() => {
    if (!animate) return
    const onMove = (e: PointerEvent) => {
      pointer.current.clientX = e.clientX
      pointer.current.clientY = e.clientY
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [animate])

  useFrame(() => {
    const m = material.current
    const g = group.current
    if (!m || !g) return
    const u = m.uniforms
    // Sprites scale with the canvas, so the heart reads the same at every size.
    u.uSize.value = size.height * 0.055 * gl.getPixelRatio()
    u.uAspect.value = size.width / size.height
    if (!animate) return
    const now = performance.now()
    began.current ??= now
    const progress = Math.min(1, (now - began.current) / FORM_MS)
    u.uProgress.value = progress
    u.uTime.value = now / 1000
    // Breathing at 60 bpm on the shared clock (in step with the ECG line), once the heart has formed.
    const formed = Math.max(0, (progress - 0.8) / 0.2)
    u.uBeat.value = 1 + (pulseScale(beatPhase(now)) - 1) * formed
    // The wireframe links appear once the settled part has formed, and breathe with it.
    wire.current?.scale.setScalar(u.uBeat.value)
    if (lineMaterial.current) lineMaterial.current.opacity = lineOpacity * formed
    // The cursor over the heart, in the canvas's own coordinates.
    const rect = gl.domElement.getBoundingClientRect()
    const p = pointer.current
    const mx = ((p.clientX - rect.left) / rect.width) * 2 - 1
    const my = -(((p.clientY - rect.top) / rect.height) * 2 - 1)
    const inside = Math.abs(mx) < 1.1 && Math.abs(my) < 1.1
    u.uMouse.value.lerp(new THREE.Vector2(mx, my), 0.2)
    u.uHover.value += ((inside ? formed : 0) - u.uHover.value) * 0.06
    // Slow idle turn, and a little parallax toward the pointer anywhere on the page.
    const t = now / 1000
    g.rotation.y += (Math.sin(t * 0.2) * 0.5 + p.x * 0.25 - g.rotation.y) * 0.03
    g.rotation.x += (-p.y * 0.15 + 0.05 - g.rotation.x) * 0.03
  })

  return (
    <group ref={group} rotation={[0.05, 0, 0]}>
      <group ref={wire}>
        <lineSegments geometry={lines}>
          <lineBasicMaterial ref={lineMaterial} color={teal} transparent opacity={animate ? 0 : lineOpacity} depthWrite={false} />
        </lineSegments>
      </group>
      <points geometry={geometry}>
        <shaderMaterial
          key={additive ? 'add' : 'normal'}
          ref={material}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
        />
      </points>
    </group>
  )
}

export interface ParticleHeartSceneProps {
  /** Share of the points that settle into the heart (ready features / all, from the roadmap). */
  settledFraction: number
  /** False: the formed heart, still (reduced motion). */
  animate: boolean
  /** Off-screen: stop rendering. */
  visible: boolean
}

/**
 * The teaser's particle heart, under construction (lazy-loaded via lazyScene): about 3000 soft points drift in as
 * a data cloud; only the share of features that are ready settles into the heart (built up from the tip, joined by
 * a few hairline links), while the rest drift loosely around it, waiting to be placed. The settled part breathes
 * at 60 bpm; the whole turns slowly, leans toward the pointer, and points step aside near the cursor. Additive glow on the dark theme; plain soft points on the light one.
 */
export default function ParticleHeartScene({ animate, visible, settledFraction }: ParticleHeartSceneProps) {
  const colors = useThemeColors()
  const { theme } = useTheme()
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 5.2], fov: 32 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      frameloop={!animate ? 'demand' : visible ? 'always' : 'never'}
      aria-hidden="true"
    >
      <Cloud animate={animate} teal={colors.accent.hex} coral={colors.coral.hex} additive={theme === 'dark'} settledFraction={settledFraction} />
    </Canvas>
  )
}
