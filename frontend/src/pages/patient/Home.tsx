import { useState } from 'react'
import { api, useResource } from '@/api'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Headline } from '@/components/ui/Headline'
import { Page, PageItem } from '@/components/ui/Page'
import { Skeleton } from '@/components/ui/Skeleton'
import { EcgLine } from '@/features/patient/EcgLine'
import { HeroVisual } from '@/features/patient/HeroVisual'
import { HowItWorks } from '@/features/patient/HowItWorks'
import { PatientFooter } from '@/features/patient/PatientFooter'
import { QuestionsSheet } from '@/features/patient/QuestionsSheet'
import { UrgentStrip } from '@/features/patient/UrgentStrip'
import { PATIENT_BASE, type RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'

/**
 * Patient Mode · Home: an editorial hero (the question, one line, two ways in) beside a living 3D heart
 * with its ECG line, then how the check works as a short story down the page, and what to do if it's
 * urgent. All copy comes from the dataset config; no numbers, models or machines.
 */
export function PatientHome({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const datasets = useResource((signal) => api.listDatasets({ signal }), [version])
  const schema = useResource((signal) => api.getFeatureSchema(datasetId, { signal }), [datasetId, version])
  const patient = datasets.data?.find((d) => d.id === datasetId)?.patient ?? null
  const home = patient?.home ?? null
  const [asking, setAsking] = useState(false)

  return (
    <Page label={route.label} className="!pt-0">
      <div className="mx-auto max-w-[84rem]">
        {/* Hero: text left (55%), the heart right */}
        <section
          aria-label="Welcome"
          className="grid min-h-[min(calc(100svh-var(--topbar-h)),52rem)] grid-cols-1 items-center gap-x-12 gap-y-10 py-12 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]"
        >
          <PageItem>
            {home ? (
              <>
                <p className="type-body-lg text-accent">{home.eyebrow}</p>
                <Headline className="mt-5 max-w-[14ch]">{home.headline}</Headline>
                <p className="mt-6 max-w-[44ch] type-body-lg text-muted">{home.subtext}</p>
              </>
            ) : (
              <div className="flex flex-col gap-5">
                <Skeleton width="12rem" height="1.5rem" />
                <Skeleton width="100%" height="10rem" />
                <Skeleton width="80%" height="3.5rem" />
              </div>
            )}
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <ButtonLink to={`${PATIENT_BASE}/assessment`} className="px-7">
                Start the check
              </ButtonLink>
              <Button variant="ghost" onClick={() => setAsking(true)} aria-haspopup="dialog" className="text-ink underline-offset-4 hover:underline">
                What will you ask me?
              </Button>
            </div>
            <p className="mt-6 type-body text-muted">Takes a few minutes. Nothing is saved after you close the page.</p>
          </PageItem>

          <PageItem className="mx-auto flex w-full max-w-[34rem] flex-col items-center">
            <div className="aspect-square w-full max-w-[min(100%,58svh)]">{home ? <HeroVisual shape={home.hero} /> : null}</div>
            {home?.hero === 'heart' && <EcgLine className="mt-2" />}
          </PageItem>
        </section>

        <PageItem className="mt-8">
          <HowItWorks />
        </PageItem>

        {patient?.urgent && (
          <PageItem className="mt-28">
            <UrgentStrip urgent={patient.urgent} />
          </PageItem>
        )}

        <PatientFooter />
      </div>

      <QuestionsSheet open={asking} onClose={() => setAsking(false)} features={schema.data?.features ?? null} />
    </Page>
  )
}
