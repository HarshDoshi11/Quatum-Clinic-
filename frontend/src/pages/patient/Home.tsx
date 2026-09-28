import { ListChecks, ScanSearch, ShieldCheck } from 'lucide-react'
import { api, useResource } from '@/api'
import { ButtonLink } from '@/components/ui/Button'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { BreathingCircle } from '@/features/patient/BreathingCircle'
import { PatientFooter } from '@/features/patient/PatientFooter'
import { PATIENT_BASE, type RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'

/**
 * Patient Mode · Home ("Calm Clinic"): the question, one warm sentence, a breathing visual,
 * one way forward, and three plain points. No numbers, models or machines.
 */
export function PatientHome({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const datasets = useResource((signal) => api.listDatasets({ signal }), [version])
  const name = datasets.data?.find((d) => d.id === datasetId)?.patient?.name ?? null

  const points = [
    {
      icon: ScanSearch,
      title: 'What it checks',
      body: `It reads the test results you already have and estimates how likely ${name ?? 'the condition'} is for people with results like yours.`,
    },
    {
      icon: ShieldCheck,
      title: 'How sure it is',
      body: 'Every result says how sure it is. If your information is incomplete or unusual, it tells you so instead of guessing.',
    },
    {
      icon: ListChecks,
      title: 'What to do next',
      body: 'You get simple next steps, questions for your doctor, and a short report you can download and share.',
    },
  ]

  return (
    <Page label={route.label}>
      <div className="grid grid-cols-1 items-center gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <PageItem as="header">
          <PageHeader route={route} />
          <p className="mt-8 max-w-[60ch] type-body-lg text-ink">
            {name ? (
              <>
                A short, private check about {name}. Answer a few questions at your own pace, and get a clear answer in plain words, with what to do
                next.
              </>
            ) : (
              <Skeleton width="100%" height="3.5rem" />
            )}
          </p>
          <div className="mt-10">
            <ButtonLink to={`${PATIENT_BASE}/assessment`}>Start assessment →</ButtonLink>
          </div>
        </PageItem>
        <PageItem className="mx-auto w-full max-w-[22rem]">
          <BreathingCircle />
        </PageItem>
      </div>

      <PageItem as="section" className="mt-16" aria-label="About this check">
        <ul className="grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-3">
          {points.map(({ icon: Icon, title, body }) => (
            <li key={title} className="max-w-[60ch]">
              <Icon size="1.5rem" strokeWidth={1.5} className="text-accent" aria-hidden="true" />
              <p className="mt-4 type-body-lg font-medium text-ink">{title}</p>
              <p className="mt-2 type-body-lg text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </PageItem>

      <PatientFooter />
    </Page>
  )
}
