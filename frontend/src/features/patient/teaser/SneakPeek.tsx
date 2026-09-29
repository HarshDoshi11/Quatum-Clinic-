import { api, useResource } from '@/api'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePatientStrings } from '@/i18n/patient'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'
import { ConfidenceMeter } from '../ConfidenceMeter'
import { PeopleRow } from '../PeopleRow'

/**
 * "A first look": the real result screen's pieces (headline, ten figures, confidence meter) for the sample
 * patient, from the API, heavily blurred and slightly tilted under a "not final" label. Decorative.
 */
export function SneakPeek() {
  const t = usePatientStrings().teaser
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const report = useResource(
    async (signal) => {
      const schema = await api.getFeatureSchema(datasetId, { signal })
      return api.getReport({ dataset: datasetId, input: schema.samplePatient }, { signal })
    },
    [datasetId, version],
  )
  const r = report.data

  return (
    <section aria-labelledby="first-look">
      <h2 id="first-look" className="type-h2 text-ink">
        {t.peekTitle}
      </h2>
      <div className="relative mt-10 max-w-[48rem]">
        <span className="absolute -top-3 left-8 z-10 rounded-control border border-accent bg-bg px-2.5 py-1 type-label text-accent">{t.peekLabel}</span>
        <div
          className="pointer-events-none rounded-panel bg-surface px-10 py-10 select-none"
          style={{ filter: 'blur(11px)', transform: 'rotate(-2deg)' }}
          aria-hidden="true"
        >
          {r ? (
            <>
              <p className="type-headline-soft text-ink">{r.result.patientHeadline ?? r.result.headline}</p>
              <div className="mt-8 flex flex-wrap items-center gap-x-10 gap-y-4">
                <PeopleRow filled={r.result.outOfTen} />
                {r.result.frequency && <p className="max-w-[28ch] type-body-lg text-ink">{r.result.frequency}</p>}
              </div>
              <div className="mt-10">
                <ConfidenceMeter level={r.reliability.level} />
              </div>
            </>
          ) : (
            <Skeleton width="100%" height="14rem" />
          )}
        </div>
      </div>
    </section>
  )
}
