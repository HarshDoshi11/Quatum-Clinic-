import { Link } from 'react-router-dom'
import { SegmentedToggle, type SegmentOption } from '@/components/ui/SegmentedToggle'
import { useAppActions } from '@/features/actions'
import { usePatientStrings } from '@/i18n/patient'
import { PATIENT_BASE } from '@/routes'
import { useMode, type Mode } from '@/state/mode'
import { useTheme, type Theme } from '@/state/theme'

/**
 * The top bar while Patient Mode is a "Coming soon" teaser: the wordmark, the same Research / Patient toggle as
 * Research Mode, and a theme toggle. Nothing else, and no icons (the theme toggle uses words).
 */
export function TeaserTopBar() {
  const { mode, setMode } = useMode()
  const { theme } = useTheme()
  const { setTheme } = useAppActions()
  const t = usePatientStrings()
  const modes: readonly SegmentOption<Mode>[] = [
    { value: 'research', label: t.teaser.modes.research },
    { value: 'patient', label: t.teaser.modes.patient },
  ]
  const themes: readonly SegmentOption<Theme>[] = [
    { value: 'light', label: t.teaser.themes.light },
    { value: 'dark', label: t.teaser.themes.dark },
  ]
  return (
    <header className="flex h-full items-center gap-4 px-6 md:px-10">
      <div className="flex min-w-0 flex-1 items-center">
        <Link to={PATIENT_BASE} className="shrink-0 type-h2 text-ink" aria-label={t.shell.home}>
          Q/Clinical
        </Link>
      </div>
      <SegmentedToggle<Mode> options={modes} value={mode} onChange={setMode} layoutId="mode-indicator" ariaLabel={t.teaser.modeLabel} />
      <div className="flex flex-1 items-center justify-end">
        <SegmentedToggle<Theme> options={themes} value={theme} onChange={setTheme} layoutId="theme-indicator" ariaLabel={t.teaser.themeLabel} size="sm" />
      </div>
    </header>
  )
}
