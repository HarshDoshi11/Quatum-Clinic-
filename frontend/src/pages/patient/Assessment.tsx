import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, useResource } from '@/api'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { PatientFooter } from '@/features/patient/PatientFooter'
import { NumberQuestion, OptionQuestion } from '@/features/patient/Questions'
import { easeGentle, stepSlide, tGentle } from '@/lib/motion'
import { PATIENT_BASE, type RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'
import { useCurrentPatient } from '@/state/patient'
import type { FeatureSpec } from '@/types'

/** The calm pause between the last answer and the result (≤ 1.2s). */
const CHECKING_MS = 1100

function ProgressBar({ step, total }: { step: number; total: number }) {
  const reduced = useReducedMotion() ?? false
  return (
    <div>
      <p className="type-body text-muted">
        Step <span className="text-ink">{Math.min(step + 1, total)}</span> of {total}
      </p>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-rule"
        role="progressbar"
        aria-label="Assessment progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={Math.min(step + 1, total)}
      >
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={false}
          animate={{ width: `${(Math.min(step + 1, total) / total) * 100}%` }}
          transition={reduced ? { duration: 0 } : { duration: 0.5, ease: easeGentle }}
        />
      </div>
    </div>
  )
}

/** A calm moment while the answers are checked, then the result page. */
function Checking() {
  const reduced = useReducedMotion() ?? false
  return (
    <div className="py-16" role="status" aria-live="polite">
      <p className="type-h2 font-serif text-ink">Checking your answers…</p>
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

/**
 * Patient Mode · Assessment ("Calm Clinic"): one group of questions per step (groups from the dataset
 * config), large tap-friendly answers with "Not sure", then a short check and My Report (the result). The
 * answers are the shared in-memory patient and go through the same pipeline as Research Mode.
 */
export function Assessment({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const navigate = useNavigate()
  const reduced = useReducedMotion() ?? false
  const schema = useResource((signal) => api.getFeatureSchema(datasetId, { signal }), [datasetId, version])
  const { patient, setPatient } = useCurrentPatient(datasetId, schema.data)
  const [[step, direction], setStep] = useState<[number, number]>([0, 1])
  const [checking, setChecking] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)
  const moved = useRef(false)

  const groups = useMemo(() => {
    const out = new Map<string, FeatureSpec[]>()
    for (const f of schema.data?.features ?? []) out.set(f.group, [...(out.get(f.group) ?? []), f])
    return [...out.entries()]
  }, [schema.data])

  const go = (next: number) => {
    moved.current = true
    setStep([next, next > step ? 1 : -1])
    topRef.current?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
  }
  useEffect(() => {
    if (!checking) return
    const t = window.setTimeout(() => navigate(`${PATIENT_BASE}/report`), reduced ? 900 : CHECKING_MS)
    return () => window.clearTimeout(t)
  }, [checking, navigate, reduced])

  const setValue = (key: string, value: number | null) => patient && setPatient({ input: { ...patient.input, [key]: value }, source: 'entered' })
  const clearAll = () => schema.data && setPatient({ input: Object.fromEntries(schema.data.features.map((f) => [f.key, null])), source: 'entered' })
  // After a step change, focus its heading once it has slid in (the old step is still mounted during the slide).
  const focusStep = (definition: unknown) => {
    if (definition === 'center' && moved.current) document.getElementById('step-title')?.focus({ preventScroll: true })
  }

  if (schema.status === 'error') {
    return (
      <Page label={route.label}>
        <PageHeader route={route} />
        <EmptyState className="mt-16" tone="error" title="Couldn’t load the questions." body={schema.error?.message} />
      </Page>
    )
  }

  const current = groups[step]
  const last = step === groups.length - 1
  return (
    <Page label={route.label}>
      <PageItem as="header">
        <PageHeader route={route} />
      </PageItem>

      <PageItem className="mt-14 max-w-[48rem]">
        <div ref={topRef} className="scroll-mt-8">
          {groups.length > 0 ? <ProgressBar step={step} total={groups.length} /> : <Skeleton width="100%" height="2.5rem" />}
        </div>

        <div className="relative mt-14 overflow-x-clip">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            {checking ? (
              <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={tGentle}>
                <Checking />
              </motion.div>
            ) : current && patient ? (
              <motion.section
                key={step}
                custom={direction}
                variants={stepSlide}
                initial="enter"
                animate="center"
                exit="exit"
                transition={reduced ? { duration: 0 } : undefined}
                onAnimationComplete={focusStep}
                aria-labelledby="step-title"
              >
                <h2 id="step-title" tabIndex={-1} className="type-h2 font-serif text-ink outline-none">
                  {current[0]}
                </h2>
                {step === 0 && patient.source !== 'entered' && (
                  <p className="mt-4 max-w-[60ch] type-body-lg text-muted">
                    We’ve filled in example answers. Change any that don’t match yours, or choose “Not sure”.{' '}
                    <button type="button" onClick={clearAll} className="text-ink underline underline-offset-4 transition-colors duration-300 hover:text-muted">
                      Start with empty answers
                    </button>
                  </p>
                )}
                <div className="mt-12 flex flex-col gap-12">
                  {current[1].map((f) =>
                    f.options ? (
                      <OptionQuestion key={f.key} feature={f} value={patient.input[f.key] ?? null} onChange={(v) => setValue(f.key, v)} />
                    ) : (
                      <NumberQuestion key={f.key} feature={f} value={patient.input[f.key] ?? null} onChange={(v) => setValue(f.key, v)} />
                    ),
                  )}
                </div>
                <div className="mt-14 flex flex-wrap items-center gap-3">
                  {step > 0 && (
                    <Button variant="outline" onClick={() => go(step - 1)}>
                      ← Back
                    </Button>
                  )}
                  <Button onClick={() => (last ? setChecking(true) : go(step + 1))}>
                    {last ? 'See my result →' : 'Next →'}
                  </Button>
                </div>
              </motion.section>
            ) : (
              <div className="flex flex-col gap-6" aria-hidden="true">
                <Skeleton width="40%" height="2.5rem" />
                <Skeleton width="100%" height="3.5rem" />
                <Skeleton width="100%" height="3.5rem" />
              </div>
            )}
          </AnimatePresence>
        </div>
      </PageItem>

      <PatientFooter />
    </Page>
  )
}
