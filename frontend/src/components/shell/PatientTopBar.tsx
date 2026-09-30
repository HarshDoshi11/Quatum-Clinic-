import { Moon, Sun } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Link, useLocation } from 'react-router-dom'
import { useAppActions } from '@/features/actions'
import { fill, usePatientStrings } from '@/i18n/patient'
import { tGentle } from '@/lib/motion'
import { PATIENT_LANGUAGES } from '@/lib/patientLanguages'
import { PATIENT_BASE, PATIENT_ROUTES } from '@/routes'
import { useMode } from '@/state/mode'
import { useTheme } from '@/state/theme'

/**
 * Patient Mode's own top bar: the wordmark, where you are (Home · Check · My result), language, theme, and a
 * quiet way back to the research view. No search, plain-language toggle or help button: patient copy is
 * always plain.
 */
export function PatientTopBar() {
  const { pathname } = useLocation()
  const { setMode } = useMode()
  const { theme } = useTheme()
  const { toggleTheme } = useAppActions()
  const reduced = useReducedMotion() ?? false
  const t = usePatientStrings().shell
  const here = pathname.replace(/\/+$/, '') || PATIENT_BASE

  return (
    <header className="@container flex h-full items-center gap-6 px-6 md:px-10">
      <Link to={PATIENT_BASE} className="shrink-0 type-h2 text-ink" aria-label={t.home}>
        JeevSetu
      </Link>

      {/* Where you are: the three steps of the check */}
      <nav aria-label={t.stepsLabel} className="mx-auto hidden @min-[44rem]:block">
        <ol className="flex items-center gap-1">
          {PATIENT_ROUTES.map((route, i) => {
            const active = here === route.path
            return (
              <li key={route.id} className="flex items-center gap-1">
                {i > 0 && (
                  <span className="px-1 text-muted" aria-hidden="true">
                    ·
                  </span>
                )}
                <Link
                  to={route.path}
                  aria-current={active ? 'step' : undefined}
                  className={`relative inline-flex h-9 items-center rounded-control px-3 type-small transition-colors duration-300 ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}
                >
                  {active && (
                    <motion.span
                      layoutId="patient-step"
                      transition={reduced ? { duration: 0 } : tGentle}
                      className="absolute inset-0 rounded-control bg-accent-soft"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative">{t.steps[route.id] ?? route.label}</span>
                </Link>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-4">
        {/* Languages: English now; Hindi and Marathi slots are ready */}
        <div role="radiogroup" aria-label={t.language} className="flex items-center gap-0.5 rounded-control border border-rule p-0.5">
          {PATIENT_LANGUAGES.map((l) => {
            const active = l.code === 'en'
            return (
              <button
                key={l.code}
                type="button"
                role="radio"
                aria-checked={active}
                aria-disabled={!l.available}
                aria-label={l.available ? l.name : fill(t.comingSoon, { name: l.name })}
                title={l.available ? l.name : fill(t.comingSoon, { name: l.name })}
                tabIndex={active ? 0 : -1}
                onClick={(e) => !l.available && e.preventDefault()}
                className={`inline-flex h-8 min-w-8 items-center justify-center rounded-[calc(var(--control-radius)-2px)] px-2 type-small transition-colors duration-300 ${
                  active ? 'bg-accent-soft text-ink' : l.available ? 'text-muted hover:text-ink' : 'cursor-not-allowed text-muted'
                }`}
              >
                {l.label}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? t.toLight : t.toDark}
          className="inline-flex h-9 w-9 items-center justify-center rounded-control border border-rule text-ink transition-colors duration-300 hover:border-rule-strong"
        >
          {theme === 'dark' ? <Sun size="1.125rem" strokeWidth={1.5} aria-hidden="true" /> : <Moon size="1.125rem" strokeWidth={1.5} aria-hidden="true" />}
        </button>

        <button
          type="button"
          onClick={() => setMode('research')}
          className="hidden type-small text-muted underline-offset-4 transition-colors duration-300 hover:text-ink hover:underline @min-[38rem]:inline"
        >
          {t.research}
        </button>
      </div>
    </header>
  )
}
