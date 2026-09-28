import { useMemo } from 'react'
import { useMode } from '@/state/mode'
import { useProjector } from '@/state/projector'
import { useTheme } from '@/state/theme'

export interface RGBA {
  /** "#rrggbb" — safe for THREE.Color. */
  hex: string
  alpha: number
}

export interface ThemeColors {
  ink: RGBA
  muted: RGBA
  accent: RGBA
  classical: RGBA
  rule: RGBA
  bg: RGBA
  riskLow: RGBA
  riskMid: RGBA
  riskHigh: RGBA
  /** Patient Home hero: the form's colour and its warm key light. */
  heroForm: RGBA
  heroLight: RGBA
}

function parse(value: string): RGBA {
  const v = value.trim()
  if (v.startsWith('#')) {
    const hex = v.length === 4 ? `#${[...v.slice(1)].map((c) => c + c).join('')}` : v.slice(0, 7)
    return { hex, alpha: 1 }
  }
  const m = v.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const [r, g, b, a = '1'] = m[1].split(',').map((x) => x.trim())
    const toHex = (n: string) => Number(n).toString(16).padStart(2, '0')
    return { hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`, alpha: Number(a) }
  }
  return { hex: '#000000', alpha: 1 }
}

/** Resolved design-token colours for canvas/WebGL, recomputed on theme change. */
export function useThemeColors(): ThemeColors {
  const { theme } = useTheme()
  const { projector } = useProjector()
  const { mode } = useMode()
  return useMemo(() => {
    void theme // recompute when the theme, projector or app mode (and so the CSS variables) change
    void projector
    void mode
    const style = getComputedStyle(document.documentElement)
    const read = (name: string) => parse(style.getPropertyValue(name))
    return {
      ink: read('--ink'),
      muted: read('--muted'),
      accent: read('--accent'),
      classical: read('--classical'),
      rule: read('--rule'),
      bg: read('--bg'),
      riskLow: read('--risk-low'),
      riskMid: read('--risk-mid'),
      riskHigh: read('--risk-high'),
      heroForm: read('--hero-form'),
      heroLight: read('--hero-light'),
    }
  }, [theme, projector, mode])
}
