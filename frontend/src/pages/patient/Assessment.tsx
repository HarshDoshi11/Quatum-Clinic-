import { Check, Phone } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, useResource } from '@/api'
import { lazyScene, SceneFrame } from '@/components/three/LazyScene'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PATIENT_ICONS } from '@/features/patient/icons'
import { Magnetic } from '@/features/patient/Magnetic'
import { PatientPage } from '@/features/patient/PatientPage'
import { NumberAnswer, OptionCards } from '@/features/patient/QuestionControls'
import { easeGentle, stepSlide } from '@/lib/motion'
import { PATIENT_BASE, type RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'
import { useT } from '@/state/language'
import { useCurrentPatient } from '@/state/patient'
import { useSpeakable } from '@/state/speech'
import type { FeatureSpec } from '@/types'

const HeroScene = lazyScene(() => import('@/features/patient/HeroScene'))

/** The calm pause between the last answer and the result (≤ 1.2s). */
const CHECKING_MS = 1100
/** How long "Good. Let's continue." stays before the first question. */
const GOOD_MS = 1000

type Screen = { kind: 'safety' } | { kind: 'urgent' } | { kind: 'good' } | { kind: 'question'; index: number } | { kind: 'checking' }

function Progress({ step, total, fraction, label }: { step: number; total: number; fraction: number; label: string }) {
  const t = useT()
  const reduced = useReducedMotion() ?? false
  return (
    <div className="max-w-[36rem]">
      <p className="type-body text-muted">
        {t('assess.step', { n: step, total })} · <span className="text-ink">{label}</span>
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-rule" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}>
        <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${fraction * 100}%` }} transition={reduced ? { duration: 0 } : { duration: 0.5, ease: easeGentle }} />
      </div>
    </div>
  )
}

/**
 * Patient Mode · Assessment: a safety check first (red flags from the dataset config; any one → urgent
 * care, and the check stops), then one question per screen with large answers and "I'm not sure", then a
 * short "Checking your answers…" with the form pulsing once, and the result. Enter continues; Back always
 * works. Answers are the shared in-memory patient and go through the one training pipeline.
 */
export function Assessment({ route }: { route: RouteMeta }) {
  const t = useT()
  const navigate = useNavigate()
  const reduced = useReducedMotion() ?? false
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const schema = useResource((signal) => api.getFeatureSchema(datasetId, { signal }), [datasetId, version])
  const datasets = useResource((signal) => api.listDatasets({ signal }), [version])
  const cfg = datasets.data?.find((d) => d.id === datasetId)?.patient ?? null
  const { patient, setPatient } = useCurrentPatient(datasetId, schema.data)
  const [[screen, direction], setScreen] = useState<[Screen, number]>([{ kind: 'safety' }, 1])
  const [flags, setFlags] = useState<Set<string>>(new Set())

  // Questions in the config's group order; progress counts the safety check as step 1.
  const questions = useMemo(() => schema.data?.features ?? [], [schema.data])
  const groups = useMemo(() => [...new Set(questions.map((f) => f.group))], [questions])
  const go = (next: Screen, dir = 1) => {
    setScreen([next, dir])
    document.getElementById('main')?.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }

  useEffect(() => {
    if (screen.kind === 'good') {
      const id = window.setTimeout(() => go({ kind: 'question', index: 0 }), reduced ? 600 : GOOD_MS)
      return () => window.clearTimeout(id)
    }
    if (screen.kind === 'checking') {
      const id = window.setTimeout(() => navigate(`${PATIENT_BASE}/report`), reduced ? 900 : CHECKING_MS)
      return () => window.clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go is stable in effect; only the screen matters
  }, [screen, navigate, reduced])

  const setValue = (key: string, value: number | null) => patient && setPatient({ input: { ...patient.input, [key]: value }, source: 'entered' })
  const clearAll = () => schema.data && setPatient({ input: Object.fromEntries(schema.data.features.map((f) => [f.key, null])), source: 'entered' })

  const current: FeatureSpec | undefined = screen.kind === 'question' ? questions[screen.index] : undefined
  const next = () => {
    if (screen.kind !== 'question') return
    if (screen.index + 1 < questions.length) go({ kind: 'question', index: screen.index + 1 })
    else go({ kind: 'checking' })
  }
  const back = () => {
    if (screen.kind === 'question') go(screen.index === 0 ? { kind: 'safety' } : { kind: 'question', index: screen.index - 1 }, -1)
    else if (screen.kind === 'urgent') go({ kind: 'safety' }, -1)
  }

  // The read-aloud toggle speaks the current screen's main text.
  const speak =
    screen.kind === 'safety' && cfg
      ? `${t('safety.title')} ${cfg.redFlags.join('. ')}.`
      : screen.kind === 'urgent'
        ? `${t('safety.urgent.title')} ${t('safety.urgent.body')} ${t('safety.urgent.wait')}`
        : current
          ? `${current.question} ${current.helper} ${current.options ? [...current.options.map((o) => o.label), t('assess.notSure')].join(', ') : ''}`
          : null
  useSpeakable(speak)

  if (schema.status === 'error') {
    return (
      <PatientPage label={route.label}>
        <EmptyState className="mt-16" tone="error" title="Couldn’t load the questions." body={schema.error?.message} />
      </PatientPage>
    )
  }

  const onEnter = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return
    e.preventDefault()
    next()
  }
  const qStep = current ? groups.indexOf(current.group) + 2 : 1
  const Icon = current ? PATIENT_ICONS[current.icon] : null

  return (
    <PatientPage label={route.label} className="mx-auto max-w-[56rem] pt-12">
      {screen.kind !== 'urgent' && screen.kind !== 'checking' && (
        <Progress
          step={screen.kind === 'question' ? qStep : 1}
          total={groups.length + 1}
          fraction={screen.kind === 'question' ? (screen.index + 1) / (questions.length + 1) : 1 / (questions.length + 1)}
          label={current ? current.group : t('assess.safetyStep')}
        />
      )}

      <div className="relative mt-14 overflow-x-clip" onKeyDown={onEnter}>
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.section
            key={screen.kind === 'question' ? `q${screen.index}` : screen.kind}
            custom={direction}
            variants={stepSlide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduced ? { duration: 0 } : undefined}
            onAnimationComplete={(def) => {
              if (def === 'center') document.getElementById('screen-title')?.focus({ preventScroll: true })
            }}
            aria-labelledby="screen-title"
          >
            {/* ── Safety check */}
            {screen.kind === 'safety' && cfg && (
              <>
                <h1 id="screen-title" tabIndex={-1} className="max-w-[20ch] type-h2 text-ink outline-none">
                  {t('safety.title')}
                </h1>
                <p className="mt-3 type-body-lg text-muted">{t('safety.helper')}</p>
                <ul className="mt-10 grid max-w-[40rem] grid-cols-1 gap-3">
                  {cfg.redFlags.map((flag) => {
                    const on = flags.has(flag)
                    return (
                      <li key={flag}>
                        <label
                          className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-panel border px-5 py-4 type-body-lg transition-[transform,box-shadow,border-color,background-color] duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] motion-reduce:hover:translate-y-0 ${
                            on ? 'border-coral bg-[color-mix(in_srgb,var(--coral)_12%,transparent)] text-ink' : 'border-rule bg-surface text-ink'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() =>
                              setFlags((f) => {
                                const n = new Set(f)
                                if (n.has(flag)) n.delete(flag)
                                else n.add(flag)
                                return n
                              })
                            }
                            className="peer sr-only"
                          />
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[0.4rem] border transition-colors duration-300 peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-accent ${on ? 'border-coral bg-coral text-bg' : 'border-rule-strong'}`}
                            aria-hidden="true"
                          >
                            {on && <Check size="0.875rem" strokeWidth={2} />}
                          </span>
                          {flag}
                        </label>
                      </li>
                    )
                  })}
                </ul>
                <div className="mt-10 flex flex-wrap items-center gap-4">
                  <Magnetic>
                    <Button className="!h-14 !px-7 !type-body-lg" onClick={() => go(flags.size > 0 ? { kind: 'urgent' } : { kind: 'good' })}>
                      {flags.size > 0 ? t('safety.continue') : `${t('safety.none')} — ${t('safety.continue').toLowerCase()}`}
                    </Button>
                  </Magnetic>
                </div>
              </>
            )}

            {/* ── Urgent care: clear, calm, high contrast; the check stops here */}
            {screen.kind === 'urgent' && cfg && (
              <div className="rounded-panel border border-coral bg-surface p-8 md:p-12" role="alert">
                <h1 id="screen-title" tabIndex={-1} className="type-display text-ink outline-none">
                  {t('safety.urgent.title')}
                </h1>
                <p className="mt-6 max-w-[48ch] type-body-lg text-ink">{t('safety.urgent.body')}</p>
                <div className="mt-10 flex flex-wrap gap-4">
                  {cfg.emergencyNumbers.map((e) => (
                    <a
                      key={e.number}
                      href={`tel:${e.number}`}
                      className="inline-flex min-h-16 items-center gap-3 rounded-control bg-ink px-7 type-h2 text-bg transition-opacity duration-300 hover:opacity-90"
                    >
                      <Phone size="1.5rem" strokeWidth={1.5} aria-hidden="true" />
                      {t('safety.urgent.call', { number: e.number })}
                      <span className="type-body-lg opacity-80">· {e.label}</span>
                    </a>
                  ))}
                </div>
                <p className="mt-10 type-body-lg text-ink">{t('safety.urgent.wait')}</p>
                <button type="button" onClick={back} className="mt-6 type-body text-muted underline underline-offset-4 transition-colors duration-300 hover:text-ink">
                  {t('safety.urgent.back')}
                </button>
              </div>
            )}

            {/* ── None selected */}
            {screen.kind === 'good' && (
              <h1 id="screen-title" tabIndex={-1} className="type-display text-ink outline-none" role="status">
                {t('safety.good')}
              </h1>
            )}

            {/* ── One question per screen */}
            {current && patient && Icon && screen.kind === 'question' && (
              <>
                <p className="flex items-center gap-2 type-body text-muted">
                  <Icon size="1.125rem" strokeWidth={1.5} aria-hidden="true" />
                  {current.plainName}
                </p>
                <h1 id="screen-title" tabIndex={-1} className="mt-3 max-w-[22ch] type-h2 text-ink outline-none">
                  {current.question}
                </h1>
                <p className="mt-3 max-w-[60ch] type-body-lg text-muted">{current.helper}</p>
                {screen.index === 0 && patient.source !== 'entered' && (
                  <p className="mt-4 max-w-[60ch] type-body text-muted">
                    {t('assess.example')}{' '}
                    <button type="button" onClick={clearAll} className="text-ink underline underline-offset-4">
                      {t('assess.empty')}
                    </button>
                  </p>
                )}
                <div className="mt-10">
                  {current.options ? (
                    <OptionCards feature={current} value={patient.input[current.key] ?? null} onChange={(v) => setValue(current.key, v)} labelledBy="screen-title" />
                  ) : (
                    <NumberAnswer feature={current} value={patient.input[current.key] ?? null} onChange={(v) => setValue(current.key, v)} onSubmit={next} />
                  )}
                </div>
                <div className="mt-12 flex flex-wrap items-center gap-3">
                  <Button variant="outline" onClick={back}>
                    ← {t('assess.back')}
                  </Button>
                  <Magnetic>
                    <Button onClick={next}>{screen.index + 1 < questions.length ? `${t('assess.next')} →` : `${t('assess.finish')} →`}</Button>
                  </Magnetic>
                  <span className="ml-2 hidden type-body text-muted md:inline">{t('assess.enter')}</span>
                </div>
              </>
            )}

            {/* ── Checking: the form pulses once */}
            {screen.kind === 'checking' && cfg && (
              <div className="flex flex-col items-start gap-8" role="status" aria-live="polite">
                <div className="h-56 w-56" aria-hidden="true">
                  <SceneFrame label="" shape="circle">
                    <HeroScene shape={cfg.heroShape} animate={!reduced} interactive={false} pulseKey={1} />
                  </SceneFrame>
                </div>
                <h1 id="screen-title" tabIndex={-1} className="type-h2 text-ink outline-none">
                  {t('assess.checking')}
                </h1>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>
    </PatientPage>
  )
}
