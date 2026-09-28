import { api, useResource } from '@/api'
import { ButtonLink } from '@/components/ui/Button'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { PATIENT_BASE, type RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'

/**
 * Patient Mode · Home: what this check is, in everyday words, and one way forward.
 * No numbers, models or machines: just what it checks, how reliable it is, and what comes next.
 * (The status strip carries "Decision support, not a diagnosis." on every Patient Mode page.)
 */
export function PatientHome({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const datasets = useResource((signal) => api.listDatasets({ signal }), [version])
  const condition = datasets.data?.find((d) => d.id === datasetId)?.condition ?? null
  const groups = useResource((signal) => api.getFeatureSchema(datasetId, { signal }), [datasetId, version])
  const steps = groups.data ? [...new Set(groups.data.features.map((f) => f.group))] : []

  const points = [
    {
      title: 'What it checks',
      body: `It looks at test results you already have and estimates how likely ${condition ?? 'the condition'} is for people with results like yours${
        steps.length > 0 ? `, in ${steps.length} short steps` : ''
      }.`,
    },
    {
      title: 'How reliable it is',
      body: 'Every result comes with its own reliability check. If your information is incomplete or unusual, it tells you so instead of guessing.',
    },
    {
      title: 'What to do next',
      body: 'You get clear next steps and questions to bring to your doctor, and a short report you can download and share.',
    },
  ]

  return (
    <Page label={route.label}>
      <PageItem as="header" className="max-w-[48rem]">
        <PageHeader route={route} />
      </PageItem>

      <PageItem className="mt-10 max-w-[44rem]">
        <p className="type-body-lg text-ink">
          {condition ? (
            <>
              This is a short, private check about <span className="whitespace-nowrap">{condition}</span>. You answer a few questions about your
              test results, one group at a time, and get your result in plain words.
            </>
          ) : (
            <Skeleton width="90%" height="3.5rem" />
          )}
        </p>
        <div className="mt-10">
          <ButtonLink to={`${PATIENT_BASE}/assessment`}>Start assessment →</ButtonLink>
        </div>
      </PageItem>

      <PageItem as="section" className="mt-24 max-w-[64rem]" aria-label="About this check">
        <ol className="grid grid-cols-1 gap-x-12 gap-y-10 border-t border-rule pt-8 md:grid-cols-3">
          {points.map((p, i) => (
            <li key={p.title}>
              <p className="type-label text-muted">
                <span className="text-ink">{String(i + 1).padStart(2, '0')}</span> — {p.title}
              </p>
              <p className="mt-4 type-body-lg text-ink">{p.body}</p>
            </li>
          ))}
        </ol>
      </PageItem>

    </Page>
  )
}
