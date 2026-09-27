/**
 * Shared chart styling. Colours are CSS variables, so charts follow theme and
 * projector mode without re-rendering. Rules (CLAUDE.md): quantum = accent,
 * classical = grey; recessive axes; tick labels ≥ 12px; direct labels over legends.
 */
import { useMemo } from 'react'
import { useProjector } from '@/state/projector'
import type { ModelFamily } from '@/types'

export const C = {
  accent: 'var(--accent)',
  classical: 'var(--classical)',
  ink: 'var(--ink)',
  muted: 'var(--muted)',
  rule: 'var(--rule)',
  ruleStrong: 'var(--rule-strong)',
  bg: 'var(--bg)',
  riskHigh: 'var(--risk-high)',
  riskLow: 'var(--risk-low)',
} as const

export const familyColor = (family: ModelFamily | null): string => (family === 'quantum' ? C.accent : C.classical)

/** Mono tick text at the micro/label size (rem → scales with projector mode). */
export const TICK = {
  fill: C.muted,
  fontFamily: 'var(--font-mono)',
  fontSize: '0.8125rem',
} as const

/** Props spread onto every XAxis / YAxis. */
export const AXIS = {
  tick: TICK,
  tickLine: false,
  axisLine: { stroke: C.ruleStrong },
  stroke: C.ruleStrong,
} as const

/** Line-draw duration; charts skip animation under reduced motion. */
export const DRAW_MS = 900

/** Round step (1, 2, 5 × 10^k) closest to `raw` — steps that print cleanly at the axis precision. */
function niceStep(raw: number): number {
  const exp = Math.floor(Math.log10(raw))
  const base = raw / 10 ** exp
  const nice = base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10
  return nice * 10 ** exp
}

/**
 * Domain and ticks on round values (e.g. 0.880 · 0.890 · 0.900), so axes never
 * show 0.916 or 26:56. `minZero` pins the domain to start at 0.
 */
export function niceScale(min: number, max: number, target = 5, minZero = false): { domain: [number, number]; ticks: number[] } {
  const lo = minZero ? 0 : min
  const span = max - lo || Math.abs(max) || 1
  const step = niceStep(span / target)
  const start = Math.floor(lo / step) * step
  const end = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = start; v <= end + step / 1e6; v += step) ticks.push(Number(v.toFixed(10)))
  return { domain: [start, end], ticks }
}

/** Like niceScale, for durations: steps are whole minutes when the range spans minutes. */
export function niceTimeScale(maxSeconds: number, target = 4): { domain: [number, number]; ticks: number[] } {
  if (maxSeconds < 120) return niceScale(0, maxSeconds, target, true)
  const minutes = niceScale(0, maxSeconds / 60, target, true)
  return { domain: [0, minutes.domain[1] * 60], ticks: minutes.ticks.map((m) => m * 60) }
}

/** Space reserved on the right for direct labels at line ends (at 16px root). */
export const LABEL_GUTTER = 128

/**
 * Pixel sizes that must track the rem-based type (projector mode scales the
 * root font): the right-hand gutter for direct labels and their minimum spacing.
 */
export function useChartUnits(): { rem: number; labelGutter: number; labelGap: number } {
  const { projector } = useProjector()
  return useMemo(() => {
    void projector
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    // Label text is 0.8125rem mono: ~0.6em per character; 20 characters + 12px offset.
    return { rem, labelGutter: Math.ceil(rem * 0.8125 * 0.62 * 20 + 16), labelGap: Math.ceil(rem * 0.8125 * 1.45) }
  }, [projector])
}
