import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { readStored, writeStored } from '@/lib/storage'

export type Theme = 'light' | 'dark'
const THEMES = ['light', 'dark'] as const
const STORAGE_KEY = 'qc.theme'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function initialTheme(): Theme {
  // index.html has already resolved the stored preference (default dark) before paint.
  const fromDom = document.documentElement.dataset.theme
  if (fromDom === 'light' || fromDom === 'dark') return fromDom
  return readStored(STORAGE_KEY, THEMES) ?? 'dark'
}

/** Update the DOM attribute synchronously, so components that read CSS variables during render see the new theme. */
function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  const themeRef = useRef(theme)
  themeRef.current = theme

  // Enable the 300ms color transition only after first paint, so load doesn't animate.
  useEffect(() => {
    const id = requestAnimationFrame(() => document.documentElement.classList.add('theme-ready'))
    return () => cancelAnimationFrame(id)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next)
    writeStored(STORAGE_KEY, next)
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => setTheme(themeRef.current === 'light' ? 'dark' : 'light'), [setTheme])

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
