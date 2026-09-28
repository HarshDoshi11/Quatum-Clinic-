import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, useResource } from '@/api'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FeatureField } from '@/components/ui/Field'
import { Headline } from '@/components/ui/Headline'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { ReliabilityMeter } from '@/features/report/ReportLetter'
import { easePrecise, panelSwap } from '@/lib/motion'
import { PATIENT_BASE, type RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'
import { useCurrentPatient } from '@/state/patient'
import type { FeatureSpec, PatientInput, RiskBand } from '@/types'

const RISK_BG: Record<RiskBand, string> = { low: 'bg-risk-low', moderate: 'bg-risk-mid', high: 'bg-risk-high' }

/** One segment per step; done and current are ink, the rest a hairline. */
function ProgressRule({ steps, current }: { steps: string[]; current: number }) {
  const reduced = useReducedMotion() ?? false
  const done = current >= steps.length
  return (
    <div>
      <p className="type-label text-muted">
        {done ? (
          'All steps done'
        ) : (
          <>
            Step <span className="num text-ink">{current + 1}</span> of <span className="num">{steps.length}</span> · {steps[current]}
          </>
        )}
      </p>
      <div
        className="mt-3 flex gap-1.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={Math.min(current, steps.length)}
        aria-label="Assessment progress"
      >
        {steps.map((s, i) => (
          <span key={s} className="relative block h-[3px] flex-1 bg-rule" aria-hidden="true">
            <motion.span
              className="absolute inset-y-0 left-0 bg-ink"
              initial={false}
              animate={{ width: i <= current ? '100%' : '0%' }}
              transition={reduced ? { duration: 0 } : { duration: 0.3, ease: easePrecise }}
            />
          </span>
        ))}
      </div>
    </div>
  )
}

/** The result in plain words: the risk word, what it means in people, how reliable it is, and what to do next. */
function ResultView({ input, onEdit }: { input: PatientInput; onEdit: () => void }) {
  const [allReasons, setAllReasons] = useState(false)
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const report = useResource((signal) => api.getReport({ dataset: datasetId, input }, { signal }), [datasetId, version, input])
  const r = report.data?.dataset === datasetId ? report.data : undefined
  // The result heading gets focus when it arrives (the report loads after the step change).
  const loaded = Boolean(r)
  useEffect(() => {
    if (loaded) document.getElementById('step-title')?.focus({ preventScroll: true })
  }, [loaded])

  if (report.status === 'error') return <EmptyState tone="error" title="Couldn’t prepare your result." body={report.error?.message} />
  if (!r) {
    return (
      <div className="flex flex-col gap-6" aria-hidden="true">
        <Skeleton width="60%" height="5rem" />
        <Skeleton width="80%" height="1.5rem" />
        <Skeleton width="50%" height="1.5rem" />
      </div>
    )
  }

  const abstained = r.result.decision === 'abstain'
  return (
    <div aria-live="polite">
      <p id="step-title" tabIndex={-1} className="type-label text-muted outline-none">
        Your result
      </p>
      {abstained ? (
        <>
          <Headline size="custom" as="h2" className="mt-4 type-h2 max-w-[40rem]">
            We couldn’t give a reliable result from this information.
          </Headline>
          <p className="mt-4 type-body-lg text-ink">Please consult a doctor.</p>
          {r.result.reasons.length > 0 && (
            <ul className="mt-6 flex max-w-[40rem] flex-col gap-2">
              {(allReasons || r.result.reasons.length <= 4 ? r.result.reasons : r.result.reasons.slice(0, 3)).map((reason) => (
                <li key={reason} className="flex gap-3 type-body-lg text-muted">
                  <span className="mt-[0.8rem] block h-1 w-1 shrink-0 bg-muted" aria-hidden="true" />
                  {reason}
                </li>
              ))}
            </ul>
          )}
          {r.result.reasons.length > 4 && (
            <button type="button" onClick={() => setAllReasons((v) => !v)} className="mt-3 type-body text-ink underline underline-offset-4 transition-colors duration-150 hover:text-muted">
              {allReasons ? 'Show fewer' : `Show ${r.result.reasons.length - 3} more`}
            </button>
          )}
        </>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-5">
            {r.result.riskBand && <span className={`block h-5 w-5 shrink-0 ${RISK_BG[r.result.riskBand]}`} aria-hidden="true" />}
            <Headline as="h2">{r.result.headline}</Headline>
          </div>
          {r.result.frequency && <p className="measure mt-6 type-body-lg text-ink">{r.result.frequency}</p>}
          <p className="measure mt-3 type-body-lg text-muted">This is a screening signal, not a diagnosis. Only your doctor can diagnose.</p>
        </>
      )}

      <div className="mt-14 grid grid-cols-1 gap-x-16 gap-y-12 border-t border-rule pt-8 lg:grid-cols-2">
        <section aria-label="How reliable it is">
          <p className="type-label text-muted">How reliable it is</p>
          <div className="mt-5">
            <ReliabilityMeter level={r.reliability.level} />
          </div>
          <p className="mt-4 type-body-lg text-ink">{r.reliability.summary}</p>
        </section>
        <section aria-label="What to do next">
          <p className="type-label text-muted">What to do next</p>
          <ol className="mt-5 flex flex-col gap-3">
            {r.nextSteps.map((s, i) => (
              <li key={s} className="flex gap-4 type-body-lg text-ink">
                <span className="num mt-[0.2rem] type-small text-muted">{String(i + 1).padStart(2, '0')}</span>
                {s}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="mt-14 flex flex-wrap gap-3">
        <ButtonLink to={`${PATIENT_BASE}/report`}>See my full report →</ButtonLink>
        <Button variant="outline" onClick={onEdit}>
          Change my answers
        </Button>
      </div>
    </div>
  )
}

/**
 * Patient Mode · Assessment: one group of questions per step, with a progress rule, then the
 * result in plain language. Answers are the shared current patient (in memory only), so My Report
 * and the research pages all describe the same person.
 */
export function Assessment({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const reduced = useReducedMotion() ?? false
  const schema = useResource((signal) => api.getFeatureSchema(datasetId, { signal }), [datasetId, version])
  const { patient, setPatient } = useCurrentPatient(datasetId, schema.data)
  const [step, setStep] = useState(0)
  const topRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => {
    const out = new Map<string, FeatureSpec[]>()
    for (const f of schema.data?.features ?? []) out.set(f.group, [...(out.get(f.group) ?? []), f])
    return [...out.entries()]
  }, [schema.data])
  const names = groups.map(([g]) => g)
  const onResult = step >= groups.length && groups.length > 0

  // Each step change brings the progress rule into view and moves focus to the new step's heading.
  const moved = useRef(false)
  const go = (next: number) => {
    moved.current = true
    setStep(next)
    topRef.current?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
  }
  // Focus once the new step has finished entering (during the crossfade the old heading is still mounted).
  const focusStep = (definition: unknown) => {
    const entered = typeof definition === 'object' && definition !== null && 'opacity' in definition && definition.opacity === 1
    if (entered && moved.current) document.getElementById('step-title')?.focus({ preventScroll: true })
  }
  const setValue = (key: string, value: number | null) => patient && setPatient({ input: { ...patient.input, [key]: value }, source: 'entered' })
  const clearAll = () => schema.data && setPatient({ input: Object.fromEntries(schema.data.features.map((f) => [f.key, null])), source: 'entered' })

  if (schema.status === 'error') {
    return (
      <Page label={route.label}>
        <PageHeader route={route} />
        <EmptyState className="mt-16" tone="error" title="Couldn’t load the questions." body={schema.error?.message} />
      </Page>
    )
  }

  const current = groups[step]
  return (
    <Page label={route.label}>
      <PageItem as="header" className="max-w-[48rem]">
        <PageHeader route={route} />
      </PageItem>

      <PageItem className="mt-12 max-w-[56rem] scroll-mt-8">
        <div ref={topRef} className="scroll-mt-8">
          {names.length > 0 ? <ProgressRule steps={names} current={step} /> : <Skeleton width="100%" height="2.5rem" />}
        </div>

        <div className="mt-12">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={onResult ? 'result' : step}
              {...panelSwap}
              transition={reduced ? { duration: 0 } : panelSwap.transition}
              onAnimationComplete={focusStep}
            >
              {onResult && patient ? (
                <ResultView input={patient.input} onEdit={() => go(0)} />
              ) : current && patient ? (
                <section aria-labelledby="step-title">
                  <h2 id="step-title" tabIndex={-1} className="type-h2 font-serif text-ink outline-none">
                    {current[0]}
                  </h2>
                  {step === 0 && patient.source !== 'entered' && (
                    <p className="measure mt-4 type-body-lg text-muted">
                      We’ve filled in example answers. Change any that don’t match your results, or choose “I don’t know”.{' '}
                      <button type="button" onClick={clearAll} className="text-ink underline underline-offset-4 transition-colors duration-150 hover:text-muted">
                        Start with empty answers
                      </button>
                    </p>
                  )}
                  <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-10 md:grid-cols-2">
                    {current[1].map((f) => (
                      <FeatureField key={f.key} feature={f} value={patient.input[f.key] ?? null} onChange={(v) => setValue(f.key, v)} plain />
                    ))}
                  </div>
                  <div className="mt-14 flex flex-wrap items-center gap-3">
                    {step > 0 && (
                      <Button variant="outline" onClick={() => go(step - 1)}>
                        ← Back
                      </Button>
                    )}
                    <Button onClick={() => go(step + 1)}>{step === groups.length - 1 ? 'See my result →' : 'Next →'}</Button>
                  </div>
                </section>
              ) : (
                <div className="flex flex-col gap-6" aria-hidden="true">
                  <Skeleton width="40%" height="2.5rem" />
                  <Skeleton width="100%" height="3rem" />
                  <Skeleton width="100%" height="3rem" />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </PageItem>
    </Page>
  )
}
