import { api, useResource } from '@/api'
import { Skeleton } from '@/components/ui/Skeleton'
import { fill, usePatientStrings } from '@/i18n/patient'
import { formatPercent } from '@/lib/format'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'

/**
 * "Built on the same engine you saw in Research Mode": three quiet facts read from the API (so from the
 * results store), never written by hand: how many datasets, how many models were compared, and how often the
 * trust checks say "not sure" instead of guessing.
 */
export function EngineStrip() {
  const t = usePatientStrings().teaser
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const datasets = useResource((signal) => api.listDatasets({ signal }), [version])
  const compare = useResource((signal) => api.compare(datasetId, { signal }), [datasetId, version])
  const trust = useResource((signal) => api.getTrust(datasetId, { signal }), [datasetId, version])
  const name = datasets.data?.find((d) => d.id === datasetId)?.name

  const stats = [
    { value: datasets.data ? String(datasets.data.length) : null, label: t.stats.datasets },
    { value: compare.data ? String(new Set(compare.data.rows.map((r) => r.model)).size) : null, label: t.stats.models },
    { value: trust.data ? formatPercent(trust.data.abstainRate) : null, label: fill(t.stats.abstain, { dataset: name ?? '' }) },
  ]

  return (
    <section aria-labelledby="engine" className="rounded-panel bg-surface px-8 py-10 md:px-12">
      <h2 id="engine" className="max-w-[28ch] type-h2 text-ink">
        {t.engineTitle}
      </h2>
      <p className="mt-3 max-w-[60ch] type-body-lg text-muted">{t.engineBody}</p>
      <dl className="mt-10 grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="border-t border-rule pt-5">
            <dt className="sr-only">{s.label}</dt>
            <dd>
              {s.value === null ? <Skeleton width="4rem" height="2.25rem" /> : <span className="block type-h2 text-ink">{s.value}</span>}
              <span className="mt-2 block type-body text-muted">{s.label}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
