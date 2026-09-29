import { Link } from 'react-router-dom'
import { SegmentedToggle, type SegmentOption } from '@/components/ui/SegmentedToggle'
import { usePatientStrings } from '@/i18n/patient'
import { PATIENT_BASE } from '@/routes'
import { useMode, type Mode } from '@/state/mode'
import { ThemeToggle } from './ThemeToggle'

/**
 * The top bar while Patient Mode is a "Coming soon" teaser: the wordmark, the same Research / Patient toggle
 * as Research Mode, and the theme toggle. Nothing else.
 */
export function TeaserTopBar() {
  const { mode, setMode } = useMode()
  const t = usePatientStrings()
  const options: readonly SegmentOption<Mode>[] = [
    { value: 'research', label: t.teaser.modes.research },
    { value: 'patient', label: t.teaser.modes.patient },
  ]
  return (
    <header className="flex h-full items-center gap-4 px-6 md:px-10">
      <div className="flex min-w-0 flex-1 items-center">
        <Link to={PATIENT_BASE} className="shrink-0 type-h2 text-ink" aria-label={t.shell.home}>
          Q/Clinical
        </Link>
      </div>
      <SegmentedToggle<Mode> options={options} value={mode} onChange={setMode} layoutId="mode-indicator" ariaLabel={t.teaser.modeLabel} />
      <div className="flex flex-1 items-center justify-end">
        <ThemeToggle />
      </div>
    </header>
  )
}
