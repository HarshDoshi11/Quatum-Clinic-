import { Share2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { api, useResource } from '@/api'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAppActions } from '@/features/actions'
import { ConfidenceMeter } from '@/features/patient/ConfidenceMeter'
import { DoctorPack } from '@/features/patient/DoctorPack'
import { LearnCards } from '@/features/patient/LearnCards'
import { PatientFooter } from '@/features/patient/PatientFooter'
import { PeopleRow } from '@/features/patient/PeopleRow'
import { EMPTY_PLAN, PlanVisit, type VisitPlan } from '@/features/patient/PlanVisit'
import { Reveal } from '@/features/patient/Reveal'
import { SectionSwitch } from '@/features/patient/SectionSwitch'
import { ShareSheet } from '@/features/patient/ShareSheet'
import { YourNumbers } from '@/features/patient/YourNumbers'
import { formatDateTime } from '@/lib/format'
import { CONFIDENCE_WORD, NO_ANSWER, NOT_A_DIAGNOSIS, readAloudScript } from '@/lib/patientText'
import { PATIENT_BASE, type RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'
import { useCurrentPatient } from '@/state/patient'
import { useSpeakable } from '@/state/speech'
import type { DatasetId } from '@/types'

type Section = 'numbers' | 'learn' | 'plan'

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="type-h2 font-serif text-ink">{children}</h2>
}

/**
 * Patient Mode · My Report: where the assessment lands. A compact result (a guiding headline, ten
 * figures and "about N in 10", how sure we are), then three sections in a segmented switch — Your
 * numbers, Learn, Plan your visit — plus Share with family and Read aloud. "Download for my doctor"
 * prints the patient's page and a "For your doctor" page.
 */
export function MyReport({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const { printReport } = useAppActions()
  const schema = useResource((signal) => api.getFeatureSchema(datasetId, { signal }), [datasetId, version])
  const datasets = useResource((signal) => api.listDatasets({ signal }), [version])
  const config = datasets.data?.find((d) => d.id === datasetId)?.patient ?? null
  const { patient } = useCurrentPatient(datasetId, schema.data)
  const input = patient?.input
  const never = () => new Promise<never>(() => {})
  const report = useResource((signal) => (input ? api.getReport({ dataset: datasetId, input }, { signal }) : never()), [datasetId, version, input])
  // The doctor's page uses the same prediction and explanation as Research Mode.
  const prediction = useResource((signal) => (input ? api.predict({ dataset: datasetId, input }, { signal }) : never()), [datasetId, version, input])
  const explanation = useResource((signal) => (input ? api.explain({ dataset: datasetId, input }, { signal }) : never()), [datasetId, version, input])
  const r = report.data?.dataset === datasetId ? report.data : undefined
  const abstained = r?.result.decision === 'abstain' || r?.result.outOfTen === null

  // With no answer, go straight to the next steps.
  const [section, setSection] = useState<{ dataset: DatasetId; value: Section } | null>(null)
  const active: Section = section?.dataset === datasetId ? section.value : abstained ? 'plan' : 'numbers'
  const [plan, setPlan] = useState<VisitPlan>(EMPTY_PLAN)
  const [sharing, setSharing] = useState(false)
  // The top bar's read-aloud toggle speaks the headline, "about N in 10", how sure we are, and the next steps.
  useSpeakable(r ? readAloudScript(r) : null)

  if (schema.status === 'error' || report.status === 'error') {
    return (
      <Page label={route.label}>
        <PageHeader route={route} />
        <EmptyState className="mt-16" tone="error" title="Couldn’t prepare your result." body={(schema.error ?? report.error)?.message} />
      </Page>
    )
  }

  return (
    <Page label={route.label} className="print:!p-0 [print-color-adjust:exact]">
      <div className="print:hidden">
        <PageItem as="header">
          <PageHeader route={route} compact>
            {r && (
              <p className="num type-small text-muted">
                {r.reportId} · {formatDateTime(r.generatedAt)}
              </p>
            )}
          </PageHeader>
          {patient && patient.source !== 'entered' && (
            <p className="mt-6 max-w-[60ch] type-body-lg text-muted">
              This uses example answers.{' '}
              <ButtonLink to={`${PATIENT_BASE}/assessment`} variant="ghost" className="!h-auto !px-0 !type-body-lg text-ink underline underline-offset-4">
                Take the assessment
              </ButtonLink>{' '}
              to use your own.
            </p>
          )}
        </PageItem>

        {r && schema.data ? (
          <div className="mt-12 max-w-[64rem]">
            {/* 1 · The result: compact, guiding, not alarming */}
            <Reveal label="Your result">
              <h2 className="type-headline-soft max-w-[24ch] text-ink">{abstained ? NO_ANSWER : r.result.patientHeadline}</h2>
              <div className="mt-8 grid grid-cols-1 items-center gap-x-12 gap-y-6 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
                <PeopleRow filled={abstained ? null : r.result.outOfTen} className="w-full max-w-[26rem]" />
                <p className="max-w-[40ch] type-body-lg text-ink">{abstained ? 'Please talk it through with your doctor. Your next steps are below.' : r.result.frequency}</p>
              </div>
              <p className="mt-4 type-body text-muted">{NOT_A_DIAGNOSIS}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setSharing(true)}>
                  <Share2 size="1.125rem" strokeWidth={1.5} aria-hidden="true" />
                  Share with family
                </Button>
              </div>
            </Reveal>

            {!abstained && (
              <Reveal className="mt-16" label="How sure are we">
                <SectionTitle>How sure are we?</SectionTitle>
                <div className="mt-6">
                  <ConfidenceMeter level={r.reliability.level} />
                </div>
                <p className="mt-5 max-w-[60ch] type-body-lg text-ink">
                  <span className="text-muted">{CONFIDENCE_WORD[r.reliability.level]} confidence. </span>
                  {r.reliability.summary}
                </p>
              </Reveal>
            )}

            {/* 2 · Three sections */}
            <Reveal className="mt-16" label="More about your result">
              <SectionSwitch<Section>
                label="More about your result"
                value={active}
                onChange={(v) => setSection({ dataset: datasetId, value: v })}
                sections={[
                  {
                    value: 'numbers',
                    label: 'Your numbers',
                    panel: config && input && <YourNumbers features={schema.data.features} input={input} ranges={config.ranges} note={config.rangesNote} />,
                  },
                  { value: 'learn', label: 'Learn', panel: config && <LearnCards features={schema.data.features} learn={config.learn} influences={r.influences} /> },
                  {
                    value: 'plan',
                    label: 'Plan your visit',
                    panel: config && (
                      <PlanVisit r={r} suggestions={config.questions} plan={plan} onPlan={setPlan} patientName={config.name} onPrint={() => printReport(r)} />
                    ),
                  },
                ]}
              />
            </Reveal>
          </div>
        ) : (
          <div className="mt-12 flex flex-col gap-6" aria-hidden="true">
            <Skeleton width="50%" height="2.5rem" />
            <Skeleton width="26rem" height="3.5rem" />
            <Skeleton width="100%" height="8rem" />
          </div>
        )}

        <PatientFooter />
      </div>

      {r && schema.data && (
        <>
          <DoctorPack
            r={r}
            plan={plan}
            prediction={prediction.data?.dataset === datasetId ? prediction.data : undefined}
            explanation={explanation.data?.dataset === datasetId ? explanation.data : undefined}
            features={schema.data.features}
          />
          <ShareSheet r={r} open={sharing} onClose={() => setSharing(false)} />
        </>
      )}
    </Page>
  )
}
