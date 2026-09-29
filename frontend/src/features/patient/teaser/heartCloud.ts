/**
 * The particle heart's points, shared by the 3D scene and its still SVG fallback so both draw the same heart.
 * Deterministic (seeded), so every render and every visit forms the same shape.
 */

/** A small seeded random generator (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A point on a parametric "pillow" heart surface: cross-sections blend from a soft ellipse at the face centre
 * to the classic heart curve at the rim. u ∈ [0, π] runs front to back, v ∈ [0, 2π] around the outline.
 */
export function heartSurface(u: number, v: number): [number, number, number] {
  const w = Math.sin(u) ** 3
  const hx = 15 * Math.sin(v) - 4 * Math.sin(3 * v)
  const hy = 15 * Math.cos(v) - 5 * Math.cos(2 * v) - 2 * Math.cos(3 * v) - Math.cos(4 * v)
  const ex = 13 * Math.sin(v)
  const ey = 12 * Math.cos(v) - 1
  const x = Math.sin(u) * (ex + (hx - ex) * w)
  const y = Math.sin(u) * (ey + (hy - ey) * w)
  const z = 7.5 * Math.cos(u)
  return [x / 17, y / 17 + 0.1, z / 17]
}

export interface HeartCloud {
  count: number
  /** Scattered "data cloud" positions. */
  start: Float32Array
  /** Positions on (and just inside) the heart surface. */
  target: Float32Array
  /** When each point sets off, 0–0.35 of the forming time: the heart assembles from its centre outwards. */
  delay: Float32Array
  /** Relative sprite size. */
  size: Float32Array
  /** A few coral points among the teal. */
  coral: Uint8Array
}

export const FORM_DELAY_MAX = 0.35

/** Surface area around (u, v), by finite differences: sampling proportional to it spreads points evenly. */
function areaAt(u: number, v: number): number {
  const h = 1e-3
  const p = heartSurface(u, v)
  const pu = heartSurface(u + h, v)
  const pv = heartSurface(u, v + h)
  const a = [pu[0] - p[0], pu[1] - p[1], pu[2] - p[2]]
  const b = [pv[0] - p[0], pv[1] - p[1], pv[2] - p[2]]
  return Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) / (h * h)
}

let maxArea = 0
function maxAreaOnce(): number {
  if (maxArea > 0) return maxArea
  for (let i = 1; i < 80; i++) for (let j = 0; j < 160; j++) maxArea = Math.max(maxArea, areaAt((i / 80) * Math.PI, (j / 160) * 2 * Math.PI))
  return (maxArea *= 1.05)
}

/** A random (u, v), kept with probability proportional to its surface area, so points spread evenly. */
function evenUV(r: () => number): [number, number] {
  for (;;) {
    const u = Math.PI * r()
    const v = 2 * Math.PI * r()
    if (r() * maxAreaOnce() <= areaAt(u, v)) return [u, v]
  }
}

export function makeHeartCloud(count: number, seed = 7): HeartCloud {
  const r = seeded(seed)
  const start = new Float32Array(count * 3)
  const target = new Float32Array(count * 3)
  const delay = new Float32Array(count)
  const size = new Float32Array(count)
  const coral = new Uint8Array(count)
  const gauss = () => (r() + r() + r() - 1.5) / 1.5
  for (let i = 0; i < count; i++) {
    const [x, y, z] = heartSurface(...evenUV(r))
    const depth = 0.86 + 0.14 * Math.sqrt(r())
    target.set([x * depth, y * depth, z * depth], i * 3)
    start.set([gauss() * 2.6, gauss() * 1.7, gauss() * 1.6], i * 3)
    const reach = Math.min(1, Math.hypot(x, y, z))
    delay[i] = FORM_DELAY_MAX * (0.7 * reach + 0.3 * r())
    size[i] = 0.6 + 0.8 * r() ** 2
    coral[i] = r() < 0.06 ? 1 : 0
  }
  return { count, start, target, delay, size, coral }
}
