import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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

const systemQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function initialTheme(): Theme {
  // index.html has already resolved stored preference / system setting before paint.
  const fromDom = document.documentElement.dataset.theme
  if (fromDom === 'light' || fromDom === 'dark') return fromDom
  return readStored(STORAGE_KEY, THEMES) ?? (systemQuery().matches ? 'dark' : 'light')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Enable the 300ms color transition only after first paint, so load doesn't animate.
  useEffect(() => {
    const id = requestAnimationFrame(() => document.documentElement.classList.add('theme-ready'))
    return () => cancelAnimationFrame(id)
  }, [])

  // Follow the OS setting until the user makes an explicit choice.
  useEffect(() => {
    if (readStored(STORAGE_KEY, THEMES)) return
    const query = systemQuery()
    const onChange = (event: MediaQueryListEvent) => {
      if (!readStored(STORAGE_KEY, THEMES)) setThemeState(event.matches ? 'dark' : 'light')
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    writeStored(STORAGE_KEY, next)
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      writeStored(STORAGE_KEY, next)
      return next
    })
  }, [])

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
