import { Moon, Sun } from 'lucide-react'
import { SegmentedToggle, type SegmentOption } from '@/components/ui/SegmentedToggle'
import { useTheme, type Theme } from '@/state/theme'

const OPTIONS: readonly SegmentOption<Theme>[] = [
  { value: 'light', label: <Sun size={14} strokeWidth={1.5} aria-hidden="true" />, ariaLabel: 'Light theme' },
  { value: 'dark', label: <Moon size={14} strokeWidth={1.5} aria-hidden="true" />, ariaLabel: 'Dark theme' },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <SegmentedToggle<Theme>
      options={OPTIONS}
      value={theme}
      onChange={setTheme}
      layoutId="theme-indicator"
      ariaLabel="Colour theme"
      size="sm"
    />
  )
}
