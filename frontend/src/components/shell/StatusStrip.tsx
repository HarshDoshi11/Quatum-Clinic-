import { Fragment, type ReactNode } from 'react'
import { api, useResource } from '@/api'
import { Skeleton } from '@/components/ui/Skeleton'
import { Term } from '@/components/ui/Term'
import { MODELS } from '@/lib/domain'
import { formatAuc, formatDate, formatTime } from '@/lib/format'
import { useDataVersion } from '@/state/dataVersion'
import { useProjector } from '@/state/projector'
import { useDataset } from '@/state/dataset'
import type { Mode } from '@/state/mode'

interface StripField {
  key: string
  label: ReactNode
  value: ReactNode
  /** Extra classes, e.g. to hide low-priority fields in a narrow strip. */
  className?: string
}

function Field({ label, value, className = '' }: Omit<StripField, 'key'>) {
  return (
    <span className={`flex items-center gap-2 whitespace-nowrap ${className}`}>
      <span className="text-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </span>
  )
}

/** Bottom status strip: live values for the selected dataset. */
export function StatusStrip({ mode }: { mode: Mode }) {
  const { datasetId, dataset } = useDataset()
  const { version } = useDataVersion()
  const { projector } = useProjector()
  const status = useResource((signal) => api.getStatus(datasetId, { signal }), [datasetId, version])
  const data = status.data

  const fields: StripField[] = [
    { key: 'dataset', label: 'Dataset', value: `${dataset.code} · ${dataset.samples}` },
    {
      key: 'best',
      label: 'Best quantum model',
      value: data ? (
        <span className="text-accent">
          {MODELS[data.bestQuantum.model].name} {formatAuc(data.bestQuantum.auc.mean)}
        </span>
      ) : (
        <Skeleton width={10} />
      ),
    },
    { key: 'qubits', className: 'hidden @min-[76rem]:flex', label: <Term term="qubit">Qubits</Term>, value: data ? data.bestQuantum.qubits : <Skeleton width={2} /> },
    { key: 'last', label: <>Last <Term term="experiment">experiment</Term></>, value: data ? data.lastExperiment.id : <Skeleton width={8} /> },
    {
      key: 'updated',
      label: 'Updated',
      value: data ? (
        <>
          <span className="hidden @min-[84rem]:inline">{formatDate(data.updatedAt)} · </span>
          {formatTime(data.updatedAt)}
        </>
      ) : (
        <Skeleton width={18} />
      ),
    },
  ]

  return (
    <footer
      aria-label="Status"
      aria-busy={status.status === 'loading'}
      className="type-micro @container flex h-full items-center gap-5 overflow-hidden border-t border-rule bg-bg px-5"
    >
      {mode === 'research' ? (
        <div className="flex min-w-0 flex-1 items-center gap-4 overflow-hidden xl:gap-5">
          {fields.map((field, i) => (
            <Fragment key={field.key}>
              {i > 0 && (
                <span className="hidden text-muted @min-[84rem]:inline" aria-hidden="true">
                  ·
                </span>
              )}
              <Field label={field.label} value={field.value} className={field.className} />
            </Fragment>
          ))}
        </div>
      ) : (
        <p className="flex-1 text-muted">Decision support, not a diagnosis.</p>
      )}
      {status.status === 'error' && <span className="shrink-0 text-risk-high">Backend unreachable</span>}
      {projector && (
        <span className="shrink-0 rounded-[2px] bg-ink px-1.5 py-px text-bg" title="Projector mode (Shift+P)">
          Projector
        </span>
      )}
    </footer>
  )
}
