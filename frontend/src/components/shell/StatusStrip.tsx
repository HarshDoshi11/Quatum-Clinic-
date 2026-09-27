import { Fragment, type ReactNode } from 'react'
import { api, useResource } from '@/api'
import { Skeleton } from '@/components/ui/Skeleton'
import { USE_MOCK } from '@/config'
import { MODELS } from '@/lib/domain'
import { formatAuc, formatDateTime } from '@/lib/format'
import { useDataset } from '@/state/dataset'
import type { Mode } from '@/state/mode'

interface StripField {
  label: string
  value: ReactNode
}

function Field({ label, value }: StripField) {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </span>
  )
}

/** Bottom status strip: live values for the selected dataset. */
export function StatusStrip({ mode }: { mode: Mode }) {
  const { datasetId, dataset } = useDataset()
  const status = useResource((signal) => api.getStatus(datasetId, { signal }), [datasetId])
  const data = status.data

  const fields: StripField[] = [
    { label: 'Dataset', value: `${dataset.code} · ${dataset.samples}` },
    {
      label: 'Best quantum model',
      value: data ? (
        <span className="text-accent">
          {MODELS[data.bestQuantum.model].name} {formatAuc(data.bestQuantum.auc.mean)}
        </span>
      ) : (
        <Skeleton width={10} />
      ),
    },
    { label: 'Qubits', value: data ? data.bestQuantum.qubits : <Skeleton width={2} /> },
    { label: 'Last experiment', value: data ? data.lastExperiment.id : <Skeleton width={8} /> },
    { label: 'Updated', value: data ? formatDateTime(data.updatedAt) : <Skeleton width={18} /> },
  ]

  return (
    <footer
      aria-label="Status"
      aria-busy={status.status === 'loading'}
      className="label-mono flex h-full items-center gap-5 overflow-hidden border-t border-rule bg-bg px-5 text-[10.5px]"
    >
      {mode === 'research' ? (
        <div className="flex min-w-0 flex-1 items-center gap-4 overflow-hidden xl:gap-5">
          {fields.map((field, i) => (
            <Fragment key={field.label}>
              {i > 0 && (
                <span className="hidden text-rule-strong xl:inline" aria-hidden="true">
                  ·
                </span>
              )}
              <Field {...field} />
            </Fragment>
          ))}
        </div>
      ) : (
        <p className="flex-1 text-muted">Decision support, not a diagnosis.</p>
      )}
      {status.status === 'error' && <span className="shrink-0 text-risk-high">Backend unreachable</span>}
      {USE_MOCK && (
        <span
          className="shrink-0 rounded-[2px] border border-rule-strong px-1.5 py-px text-ink"
          title="Showing mock data — set VITE_USE_MOCK=false to call the backend"
        >
          Mock data
        </span>
      )}
    </footer>
  )
}
