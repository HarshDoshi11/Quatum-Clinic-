import type { ReactElement } from 'react'
import { C } from './chartTheme'

export interface LabelTarget {
  key: string
  value: number
}

/**
 * Vertical offsets (px) that keep direct labels at least `minGap` apart.
 * Positions are estimated from the y-domain and plot height; labels are pushed
 * apart symmetrically around their cluster centre, then clamped to the plot.
 */
export function resolveLabelOffsets(targets: LabelTarget[], domain: [number, number], plotHeight: number, minGap = 18): Record<string, number> {
  if (plotHeight <= 0 || targets.length === 0) return {}
  const [lo, hi] = domain
  const toPx = (v: number) => (1 - (v - lo) / (hi - lo)) * plotHeight
  const items = targets.map((t) => ({ key: t.key, ideal: toPx(t.value), pos: toPx(t.value) })).sort((a, b) => a.ideal - b.ideal)

  // Iteratively relax overlaps (small n, converges quickly).
  for (let iter = 0; iter < 40; iter++) {
    let moved = false
    for (let i = 1; i < items.length; i++) {
      const gap = items[i].pos - items[i - 1].pos
      if (gap < minGap) {
        const push = (minGap - gap) / 2
        items[i - 1].pos -= push
        items[i].pos += push
        moved = true
      }
    }
    if (!moved) break
  }
  const out: Record<string, number> = {}
  for (const it of items) out[it.key] = Math.min(Math.max(it.pos, 0), plotHeight) - it.ideal
  return out
}

interface EndLabelProps {
  /** Supplied by Recharts. */
  x?: number | string
  y?: number | string
  index?: number
}

/**
 * Factory for a Recharts `label` renderer that draws one direct label at the
 * last point of a line. Text uses ink (never the series colour).
 */
export function endLabel(lastIndex: number, text: string, dy = 0) {
  return function EndLabel(raw: unknown): ReactElement {
    const { x, y, index } = raw as EndLabelProps
    if (index !== lastIndex || x === undefined || y === undefined) return <g />
    return (
      <text
        x={Number(x) + 12}
        y={Number(y) + dy}
        dy="0.35em"
        fill={C.ink}
        fontFamily="var(--font-mono)"
        fontSize="0.8125rem"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {text}
      </text>
    )
  }
}
