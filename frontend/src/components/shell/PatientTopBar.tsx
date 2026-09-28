import { Moon, Sun, Volume2, VolumeX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppActions } from '@/features/actions'
import { PillSwitch } from '@/features/patient/PillSwitch'
import { PATIENT_BASE } from '@/routes'
import { LANGUAGE_INFO, LANGUAGES, useLanguage, useT, type Language } from '@/state/language'
import { useMode } from '@/state/mode'
import { useSpeech } from '@/state/speech'
import { useTheme, type Theme } from '@/state/theme'

/**
 * Patient Mode's minimal top bar: the wordmark, language, read aloud, theme, and a quiet way back to
 * the research view. No search, plain-language toggle, backend status or status strip here.
 */
export function PatientTopBar() {
  const t = useT()
  const { lang, setLang } = useLanguage()
  const { theme } = useTheme()
  const { setTheme } = useAppActions()
  const { setMode } = useMode()
  const speech = useSpeech()
  return (
    <header className="flex h-full items-center gap-4 px-6 md:px-10">
      <Link to={PATIENT_BASE} className="type-h2 text-ink" aria-label="Q/Clinical home">
        Q/Clinical
      </Link>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
        <PillSwitch<Language>
          label={t('shell.language')}
          layoutId="patient-lang"
          value={lang}
          onChange={setLang}
          options={LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_INFO[l].name, lang: l }))}
        />
        {speech.supported && (
          <button
            type="button"
            onClick={speech.toggle}
            aria-pressed={speech.speaking}
            className="inline-flex h-9 items-center gap-2 rounded-control border border-rule px-3 type-small text-ink transition-colors duration-300 hover:border-rule-strong"
          >
            {speech.speaking ? <VolumeX size="1rem" strokeWidth={1.5} aria-hidden="true" /> : <Volume2 size="1rem" strokeWidth={1.5} aria-hidden="true" />}
            {speech.speaking ? t('shell.stopReading') : t('shell.readAloud')}
          </button>
        )}
        <PillSwitch<Theme>
          label="Colour theme"
          layoutId="patient-theme"
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'light', label: <Sun size="1rem" strokeWidth={1.5} aria-hidden="true" />, ariaLabel: 'Light theme' },
            { value: 'dark', label: <Moon size="1rem" strokeWidth={1.5} aria-hidden="true" />, ariaLabel: 'Dark theme' },
          ]}
        />
        <button type="button" onClick={() => setMode('research')} className="type-small text-muted underline-offset-4 transition-colors duration-300 hover:text-ink hover:underline">
          {t('shell.researchView')} →
        </button>
      </div>
    </header>
  )
}
