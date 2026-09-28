import { useEffect, useState } from 'react'
import { api, useResource } from '@/api'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Headline } from '@/components/ui/Headline'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { PatientFooter } from '@/features/patient/PatientFooter'
import { ReliabilityMeter } from '@/features/report/ReportLetter'
import { PATIENT_BASE, type RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'
import { useCurrentPatient } from '@/state/patient'
import type { PatientInput, RiskBand } from '@/types'

const RISK_BG: Record<RiskBand, string> = { low: 'bg-risk-low', moderate: 'bg-risk-mid', high: 'bg-risk-high' }

/** The result in plain words: the risk word, what it means in people, how reliable it is, and what to do next. */
function ResultView({ input }: { input: PatientInput }) {
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
        <ButtonLink to={`${PATIENT_BASE}/assessment`} variant="outline">
          Change my answers
        </ButtonLink>
      </div>
    </div>
  )
}

/**
 * Patient Mode · Your result: where the assessment lands. (The layout is the pre-redesign result
 * screen; Part B of the Calm Clinic redesign replaces it.)
 */
export function PatientResult({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const schema = useResource((signal) => api.getFeatureSchema(datasetId, { signal }), [datasetId, version])
  const { patient } = useCurrentPatient(datasetId, schema.data)
  return (
    <Page label={route.label}>
      <PageItem as="header">
        <PageHeader route={route} />
      </PageItem>
      <PageItem className="mt-14 max-w-[64rem]">{patient ? <ResultView input={patient.input} /> : <Skeleton width="60%" height="5rem" />}</PageItem>
      <PatientFooter />
    </Page>
  )
}
