import { Fragment, type ReactNode } from 'react'
import { USE_MOCK } from '@/config'
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

/**
 * Bottom status strip. Values are static placeholders in Phase 1 and are
 * wired to the mock/API service layer in Phase 2.
 */
export function StatusStrip({ mode }: { mode: Mode }) {
  const { dataset } = useDataset()

  const fields: StripField[] = [
    { label: 'Dataset', value: `${dataset.code} · ${dataset.samples}` },
    { label: 'Best quantum model', value: <span className="text-accent">QSVM 0.914</span> },
    { label: 'Qubits', value: '4' },
    { label: 'Last experiment', value: 'EXP-2048' },
    { label: 'Updated', value: '2026-09-27 14:32' },
  ]

  return (
    <footer
      aria-label="Status"
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
