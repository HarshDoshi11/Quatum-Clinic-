import { ArrowLeft, ArrowRight, FileSearch, Info } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, useResource } from '@/api'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatFeatureValue } from '@/components/ui/Field'
import { Page } from '@/components/ui/Page'
import { Skeleton } from '@/components/ui/Skeleton'
import { ChoiceAnswer, NumberAnswer, type AnswerChoice } from '@/features/patient/assessment/Answers'
import { WhereToFind } from '@/features/patient/assessment/WhereToFind'
import { PATIENT_ICONS } from '@/features/patient/icons'
import { PatientFooter } from '@/features/patient/PatientFooter'
import { CallButtons } from '@/features/patient/UrgentStrip'
import { fill, usePatientStrings } from '@/i18n/patient'
import type { AssessmentStep } from '@/lib/domain'
import { easeGentle, stepSlide, tGentle } from '@/lib/motion'
import { PATIENT_BASE, type RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'
import { useCurrentPatient } from '@/state/patient'
import type { FeatureSpec, PatientInput } from '@/types'

/** The calm pause between "See my result" and the result (≤ 1.2s). */
const CHECKING_MS = 1100

type Screen = 'safety' | 'urgent' | 'report' | 'question' | 'review' | 'checking'

interface Question {
  feature: FeatureSpec
  step: AssessmentStep
}

const outside = (f: FeatureSpec, v: number | null) => v !== null && (v < f.min || v > f.max)

/** A large option that moves the conversation on (safety answer, report choice). */
function BigChoice({ label, body, onClick, autoFocus = false }: { label: string; body?: string; onClick: () => void; autoFocus?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-autofocus={autoFocus ? '' : undefined}
      className="flex min-h-16 flex-col justify-center rounded-panel border border-rule-strong px-6 py-4 text-left transition-colors duration-300 hover:border-accent hover:bg-accent-soft"
    >
      <span className="type-body-lg font-medium text-ink">{label}</span>
      {body && <span className="mt-1 type-body text-muted">{body}</span>}
    </button>
  )
}

/**
 * Patient Mode · Assessment: a guided conversation for someone holding a report they don't understand.
 * A safety question first (when the condition has urgent signs), then whether they have their report,
 * then one question per screen in plain words, with "not sure" always an equal answer, and a review.
 * The answers are the shared in-memory patient and go, unchanged, through the same pipeline and trust
 * checks as Research Mode: a value outside the usual range is kept as entered, so the result can abstain.
 */
export function Assessment({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const navigate = useNavigate()
  const reduced = useReducedMotion() ?? false
  const t = usePatientStrings()
  const words = t.datasets[datasetId]
  const datasets = useResource((signal) => api.listDatasets({ signal }), [version])
  const schema = useResource((signal) => api.getFeatureSchema(datasetId, { signal }), [datasetId, version])
  const config = datasets.data?.find((d) => d.id === datasetId)?.patient ?? null
  const { patient, setPatient } = useCurrentPatient(datasetId, schema.data)

  const [[screenState, index, direction], setView] = useState<[Screen | null, number, number]>([null, 0, 1])
  const [hasReport, setHasReport] = useState<boolean | null>(null)
  const [notSure, setNotSure] = useState<Set<string>>(() => new Set())
  const [fromReview, setFromReview] = useState(false)
  const [prompt, setPrompt] = useState(false)
  const [finding, setFinding] = useState<string | null>(null)
  const moved = useRef(false)
  const screenRef = useRef<HTMLElement>(null)
  const screen: Screen = screenState ?? (config?.safetyCheck ? 'safety' : 'report')

  // Coming back with your own answers: the empty ones were "not sure".
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || !patient) return
    seeded.current = true
    if (patient.source === 'entered') setNotSure(new Set(Object.keys(patient.input).filter((k) => patient.input[k] === null)))
  }, [patient])

  const byKey = useMemo(() => new Map((schema.data?.features ?? []).map((f) => [f.key, f])), [schema.data])
  const listFor = (withReport: boolean): Question[] =>
    (config?.assessment.steps ?? [])
      .filter((s) => withReport || !s.fromReport)
      .flatMap((step) => step.features.flatMap((k) => (byKey.has(k) ? [{ feature: byKey.get(k) as FeatureSpec, step }] : [])))
  const questions = listFor(hasReport !== false)
  const everything = listFor(true)

  const go = (next: Screen, i = 0, dir = 1) => {
    moved.current = true
    setPrompt(false)
    setView([next, i, dir])
  }

  useEffect(() => {
    if (screen !== 'checking') return
    const id = window.setTimeout(() => navigate(`${PATIENT_BASE}/report`), reduced ? 900 : CHECKING_MS)
    return () => window.clearTimeout(id)
  }, [screen, navigate, reduced])

  // After a screen slides in, focus its answer (or its question) so Enter and the arrows work straight away.
  const focusScreen = (definition: unknown) => {
    if (definition !== 'center' || !moved.current) return
    const el = screenRef.current
    const target = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>('h1')
    target?.focus({ preventScroll: true })
  }

  if (schema.status === 'error' || datasets.status === 'error') {
    return (
      <Page label={route.label}>
        <EmptyState className="mt-16" tone="error" title="Couldn’t load the questions." body={(schema.error ?? datasets.error)?.message} />
      </Page>
    )
  }

  const setValue = (key: string, value: number | null, unsure = false) => {
    if (!patient) return
    setPatient({ input: { ...patient.input, [key]: value }, source: 'entered' })
    setNotSure((s) => {
      const next = new Set(s)
      if (unsure) next.add(key)
      else next.delete(key)
      return next
    })
    setPrompt(false)
  }

  const chooseReport = (yes: boolean) => {
    if (!patient || !config) return
    const fresh = patient.source !== 'entered'
    const input: PatientInput = fresh ? Object.fromEntries(everything.map((q) => [q.feature.key, null])) : { ...patient.input }
    // Without the report, report values aren't asked: none is kept from before.
    if (!yes) for (const s of config.assessment.steps) if (s.fromReport) for (const k of s.features) input[k] = null
    setPatient({ input, source: 'entered' })
    if (fresh) setNotSure(new Set())
    setHasReport(yes)
    if (listFor(yes).length === 0) go('review')
    else go('question', 0)
  }

  const tryExample = () => {
    if (!schema.data) return
    setPatient({ input: schema.data.samplePatient, source: 'sample' })
    setNotSure(new Set())
    setHasReport(true)
    go('review')
  }

  const q = screen === 'question' ? questions[index] : undefined
  const decided = (key: string) => (patient?.input[key] ?? null) !== null || notSure.has(key)

  const next = (committed = false) => {
    if (!q) return
    if (!committed && !decided(q.feature.key)) {
      setPrompt(true)
      return
    }
    if (fromReview || index === questions.length - 1) {
      setFromReview(false)
      go('review', 0, 1)
    } else go('question', index + 1, 1)
  }
  const back = () => {
    if (screen === 'question') {
      if (fromReview) {
        setFromReview(false)
        go('review', 0, -1)
      } else if (index > 0) go('question', index - 1, -1)
      else go('report', 0, -1)
    } else if (screen === 'review') go(questions.length > 0 ? 'question' : 'report', Math.max(0, questions.length - 1), -1)
    else if (screen === 'report' && config?.safetyCheck) go('safety', 0, -1)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' && screen === 'question' && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault()
      next()
    }
  }

  const loading = !patient || !config
  let body: ReactNode
  if (loading) {
    body = (
      <div className="flex flex-col gap-6 pt-12" aria-hidden="true">
        <Skeleton width="30%" height="1.5rem" />
        <Skeleton width="80%" height="3.5rem" />
        <Skeleton width="100%" height="8rem" />
      </div>
    )
  } else if (screen === 'safety') {
    body = (
      <>
        <p className="type-body-lg text-accent">{t.safety.eyebrow}</p>
        <h1 tabIndex={-1} className="mt-4 max-w-[22ch] type-question text-ink outline-none">
          {t.safety.ask}
        </h1>
        <p className="mt-3 type-body-lg text-muted">{t.safety.why}</p>
        <ul className="mt-8 flex max-w-[40rem] flex-col gap-3">
          {(words.urgent?.signs ?? []).map((s) => (
            <li key={s} className="flex items-center gap-4 rounded-panel bg-surface px-5 py-3.5 type-body-lg text-ink">
              <span className="size-2 shrink-0 rounded-full bg-coral" aria-hidden="true" />
              {s}
            </li>
          ))}
        </ul>
        <div className="mt-8 grid max-w-[40rem] grid-cols-1 gap-3 sm:grid-cols-2">
          <BigChoice label={t.safety.yes} onClick={() => go('urgent')} />
          <BigChoice label={t.safety.no} onClick={() => go('report')} autoFocus />
        </div>
      </>
    )
  } else if (screen === 'urgent') {
    body = (
      <>
        <h1 tabIndex={-1} className="max-w-[18ch] type-display text-ink outline-none">
          {t.urgentScreen.title}
        </h1>
        <p className="mt-6 max-w-[52ch] type-body-lg text-ink">{t.urgentScreen.body}</p>
        <div className="mt-10">
          <CallButtons label={(n) => fill(t.urgentScreen.call, { number: n })} />
        </div>
        <button
          type="button"
          onClick={() => go('safety', 0, -1)}
          className="mt-16 type-body text-muted underline underline-offset-4 transition-colors duration-300 hover:text-ink"
        >
          {t.urgentScreen.mistake}
        </button>
      </>
    )
  } else if (screen === 'report') {
    body = (
      <>
        <h1 tabIndex={-1} className="max-w-[22ch] type-question text-ink outline-none">
          {words.report.ask}
        </h1>
        <div className="mt-10 grid max-w-[48rem] grid-cols-1 gap-3 md:grid-cols-2">
          <BigChoice label={words.report.yes.label} body={words.report.yes.body} onClick={() => chooseReport(true)} autoFocus />
          <BigChoice label={words.report.no.label} body={words.report.no.body} onClick={() => chooseReport(false)} />
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
          {config.safetyCheck && (
            <Button variant="outline" onClick={back}>
              <ArrowLeft size="1.125rem" strokeWidth={1.5} aria-hidden="true" />
              {t.question.back}
            </Button>
          )}
          <button type="button" onClick={tryExample} className="type-body text-muted underline underline-offset-4 transition-colors duration-300 hover:text-ink">
            {t.reportChoice.example}
          </button>
        </div>
      </>
    )
  } else if (screen === 'question' && q) {
    const f = q.feature
    const fw = words.features[f.key]
    const value = patient.input[f.key] ?? null
    const unsureLabel = q.step.fromReport ? t.question.notOnReport : t.question.notSure
    const optionWords = fw?.options
    const choices: AnswerChoice[] | null =
      f.options || optionWords
        ? [
            ...(f.options ?? Object.keys(optionWords ?? {}).map((v) => ({ value: Number(v), label: '' }))).map((o) => ({
              value: o.value,
              label: optionWords?.[o.value]?.label ?? o.label,
              example: optionWords?.[o.value]?.example,
            })),
            { value: null, label: unsureLabel },
          ]
        : null
    const selected = choices ? (notSure.has(f.key) ? choices.length - 1 : choices.findIndex((c) => c.value !== null && value !== null && c.value === Math.round(value))) : -1
    const range = config.ranges[f.key]
    const bounds = { min: formatFeatureValue(f, f.min), max: formatFeatureValue(f, f.max) }
    const ids = { q: `q-${f.key}`, why: `why-${f.key}` }
    const total = questions.length
    body = (
      <>
        <div>
          <div className="flex items-baseline justify-between gap-6">
            <p className="type-body text-accent">{words.steps[q.step.id]}</p>
            <p className="type-body text-muted" aria-hidden="true">
              {fill(t.question.progress, { n: index + 1, total })}
            </p>
          </div>
          <div
            className="mt-3 h-1 overflow-hidden rounded-full bg-rule"
            role="progressbar"
            aria-label={fill(t.question.progressLabel, { n: index + 1, total })}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={index + 1}
          >
            <motion.div
              className="h-full rounded-full bg-accent"
              initial={false}
              animate={{ width: `${((index + 1) / total) * 100}%` }}
              transition={reduced ? { duration: 0 } : { duration: 0.5, ease: easeGentle }}
            />
          </div>
        </div>

        <h1 id={ids.q} tabIndex={-1} className="mt-10 max-w-[26ch] type-question text-ink outline-none [@media(max-height:52rem)]:mt-8">
          {fw?.ask ?? f.question}
        </h1>
        <p id={ids.why} className="mt-3 max-w-[60ch] type-body-lg text-muted">
          {fw?.why}
        </p>

        <div className="mt-8 [@media(max-height:52rem)]:mt-6">
          {choices ? (
            <ChoiceAnswer
              key={f.key}
              labelledBy={ids.q}
              choices={choices}
              selected={selected}
              onPick={(c) => setValue(f.key, c.value, c.value === null)}
              onCommit={(c) => {
                setValue(f.key, c.value, c.value === null)
                next(true)
              }}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <NumberAnswer key={f.key} feature={f} labelledBy={ids.q} describedBy={ids.why} value={notSure.has(f.key) ? null : value} onChange={(v) => setValue(f.key, v)} />
              <button
                type="button"
                aria-pressed={notSure.has(f.key)}
                onClick={() => setValue(f.key, null, true)}
                className={`inline-flex min-h-16 items-center rounded-panel border border-dashed px-6 type-body-lg transition-colors duration-300 ${
                  notSure.has(f.key) ? 'border-accent bg-accent-soft text-ink' : 'border-rule-strong text-muted hover:border-ink hover:text-ink'
                }`}
              >
                {unsureLabel}
              </button>
            </div>
          )}
          {range && !choices && <p className="mt-3 type-body text-muted">{fill(t.question.typical, { healthy: range.healthy })}</p>}
          {outside(f, value) && (
            <p role="status" className="mt-4 flex max-w-[60ch] items-start gap-3 rounded-panel bg-surface px-5 py-3 type-body text-ink">
              <Info size="1.125rem" strokeWidth={1.5} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
              {fill(fw?.rangeNote ?? t.question.outOfRange, fw?.rangeNote ? { min: f.min, max: f.max } : bounds)}
            </p>
          )}
          {prompt && (
            <p role="alert" className="mt-4 type-body text-ink">
              {fill(t.question.choose, { notSure: unsureLabel })}
            </p>
          )}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-3 [@media(max-height:52rem)]:mt-8">
          <Button variant="outline" onClick={back}>
            <ArrowLeft size="1.125rem" strokeWidth={1.5} aria-hidden="true" />
            {fromReview ? t.question.toReview : t.question.back}
          </Button>
          <Button onClick={() => next()}>
            {fromReview ? t.question.toReview : t.question.next}
            <ArrowRight size="1.125rem" strokeWidth={1.5} aria-hidden="true" />
          </Button>
          <span className="type-body text-muted">{t.question.enterHint}</span>
          {fw?.find && (
            <button
              type="button"
              onClick={() => setFinding(f.key)}
              aria-haspopup="dialog"
              className="inline-flex items-center gap-2 type-body-lg text-ink underline underline-offset-4 transition-colors duration-300 hover:text-muted sm:ml-auto"
            >
              <FileSearch size="1.25rem" strokeWidth={1.5} className="text-accent" aria-hidden="true" />
              {t.question.whereToFind}
            </button>
          )}
        </div>
      </>
    )
  } else if (screen === 'review') {
    const missing = everything.filter((x) => (patient.input[x.feature.key] ?? null) === null).length
    const note =
      missing === 0
        ? t.review.complete
        : missing === everything.length
          ? t.review.missingAll
          : missing === 1
            ? t.review.missingOne
            : fill(t.review.missingMany, { n: missing })
    const asked = new Set(questions.map((x) => x.feature.key))
    body = (
      <>
        <h1 tabIndex={-1} className="type-question text-ink outline-none">
          {t.review.title}
        </h1>
        <p className="mt-2 type-body-lg text-muted">{patient.source === 'sample' ? `${t.review.example} ${t.review.intro}` : t.review.intro}</p>
        <ul className="mt-6 grid grid-cols-1 gap-x-10 rounded-panel bg-surface px-6 py-1.5 md:grid-cols-2 [@media(max-height:52rem)]:mt-5">
          {everything.map(({ feature: f }) => {
            const v = patient.input[f.key] ?? null
            const Icon = PATIENT_ICONS[f.icon]
            const option = v !== null ? words.features[f.key]?.options?.[Math.round(v)]?.label : undefined
            const shown = !asked.has(f.key) ? t.review.notAsked : v === null ? t.review.notSure : (option ?? formatFeatureValue(f, v))
            const i = questions.findIndex((x) => x.feature.key === f.key)
            return (
              <li key={f.key} className="flex h-11 items-center gap-3 border-b border-rule last:border-b-0 md:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
                <Icon size="1.125rem" strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate type-body text-muted" title={f.question}>
                  {f.question}
                </span>
                <span className={`min-w-0 max-w-[55%] truncate text-right type-body ${v === null ? 'text-muted' : 'text-ink'}`} title={shown}>
                  {shown}
                </span>
                {i >= 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFromReview(true)
                      go('question', i, -1)
                    }}
                    aria-label={fill(t.review.editLabel, { question: f.question })}
                    className="shrink-0 rounded-control px-2 py-1 type-body text-ink underline underline-offset-4 transition-colors duration-300 hover:text-muted"
                  >
                    {t.review.edit}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        <p className="mt-5 max-w-[60ch] type-body-lg text-ink [@media(max-height:52rem)]:mt-4">{note}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={back}>
            <ArrowLeft size="1.125rem" strokeWidth={1.5} aria-hidden="true" />
            {t.question.back}
          </Button>
          <Button onClick={() => go('checking')} data-autofocus="">
            {t.review.see}
            <ArrowRight size="1.125rem" strokeWidth={1.5} aria-hidden="true" />
          </Button>
        </div>
      </>
    )
  } else {
    body = (
      <div className="pt-8" role="status" aria-live="polite">
        <p className="type-question text-ink">{t.checking}</p>
        <div className="mt-8 h-1 max-w-[24rem] overflow-hidden rounded-full bg-rule" aria-hidden="true">
          <motion.div
            className="h-full rounded-full bg-accent"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={reduced ? { duration: 0 } : { duration: CHECKING_MS / 1000, ease: easeGentle }}
          />
        </div>
      </div>
    )
  }

  const key = screen === 'question' ? `q-${index}` : screen
  return (
    <Page label={route.label} className="!pt-0 !pb-0">
      <div className="mx-auto flex min-h-[calc(100svh-var(--topbar-h))] max-w-[60rem] flex-col">
        <div className="flex-1 overflow-x-clip pt-12 [@media(max-height:52rem)]:pt-8">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.section
              key={key}
              ref={screenRef}
              custom={direction}
              variants={stepSlide}
              initial="enter"
              animate="center"
              exit="exit"
              transition={reduced ? { duration: 0 } : tGentle}
              onAnimationComplete={focusScreen}
              onKeyDown={onKeyDown}
              aria-live="off"
            >
              {body}
            </motion.section>
          </AnimatePresence>
        </div>
        <PatientFooter className="mt-10 pb-6 [@media(max-height:52rem)]:mt-6 [@media(max-height:52rem)]:pb-4" />
      </div>

      {config && (
        <WhereToFind open={finding !== null} onClose={() => setFinding(null)} featureKey={finding} assessment={config.assessment} strings={words} />
      )}
    </Page>
  )
}
