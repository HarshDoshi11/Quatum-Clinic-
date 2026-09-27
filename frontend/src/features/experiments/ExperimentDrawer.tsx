import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { api, useResource } from '@/api'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Term } from '@/components/ui/Term'
import { BACKENDS, DATASETS, MODELS } from '@/lib/domain'
import { durationColumn, formatDateTime, formatMs, formatStd } from '@/lib/format'
import type { GlossaryKey } from '@/lib/glossary'
import { useAppActions } from '@/features/actions'
import { useDataVersion } from '@/state/dataVersion'
import type { Experiment, ExperimentMetrics, MeanStd } from '@/types'

// ─── Context ────────────────────────────────────────────────

interface ExperimentDrawerValue {
  openExperiment: (id: string) => void
}

const ExperimentDrawerContext = createContext<ExperimentDrawerValue | null>(null)

export function useExperimentDrawer(): ExperimentDrawerValue {
  const ctx = useContext(ExperimentDrawerContext)
  if (!ctx) throw new Error('useExperimentDrawer must be used inside <ExperimentDrawerProvider>')
  return ctx
}

export function ExperimentDrawerProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(null)
  const close = useCallback(() => setId(null), [])
  const value = useMemo(() => ({ openExperiment: setId }), [])

  return (
    <ExperimentDrawerContext.Provider value={value}>
      {children}
      <Drawer open={id !== null} onClose={close} label={id ? `Experiment ${id}` : 'Experiment'}>
        {id && <ExperimentDetail id={id} onOpen={setId} />}
      </Drawer>
    </ExperimentDrawerContext.Provider>
  )
}

// ─── Detail view ────────────────────────────────────────────

const METRIC_ROWS: { key: keyof ExperimentMetrics; label: ReactNode; format: (m: MeanStd) => [string, string] }[] = [
  { key: 'auc', label: <Term>AUC</Term>, format: (m) => [m.mean.toFixed(3), formatStd(m.std)] },
  { key: 'accuracy', label: 'Accuracy', format: (m) => [m.mean.toFixed(3), formatStd(m.std)] },
  { key: 'sensitivity', label: <Term>Sensitivity</Term>, format: (m) => [m.mean.toFixed(3), formatStd(m.std)] },
  { key: 'specificity', label: <Term>Specificity</Term>, format: (m) => [m.mean.toFixed(3), formatStd(m.std)] },
  // One unit for the cell: mean and spread share the formatter chosen for the mean.
  { key: 'trainTimeS', label: 'Train time', format: (m) => ((f) => [f(m.mean), `±${f(m.std)}`] as [string, string])(durationColumn([m.mean])) },
  { key: 'inferenceMs', label: 'Inference', format: (m) => [formatMs(m.mean), `±${formatMs(m.std)}`] },
]

function Row({ label, value, term }: { label: string; value: ReactNode; term?: GlossaryKey }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-rule py-2.5">
      <dt className="type-ui text-muted">{term ? <Term term={term}>{label}</Term> : label}</dt>
      <dd className="num text-right type-ui text-ink">{value}</dd>
    </div>
  )
}

const dash = '—'

function ExperimentBody({ exp }: { exp: Experiment }) {
  const { copyExperimentId } = useAppActions()
  const c = exp.config
  const quantum = c.qubits !== null
  const n = c.noise

  return (
    <div className="px-8 pt-8 pb-10">
      <p className="type-label text-muted">
        {exp.kind} · {exp.status} · {DATASETS[exp.dataset].code}
      </p>
      <div className="mt-4 flex items-end gap-4">
        <h2 className="type-metric text-ink">{exp.id}</h2>
        <button
          type="button"
          onClick={() => copyExperimentId(exp.id)}
          aria-label={`Copy ${exp.id}`}
          className="type-label mb-1 rounded-[2px] border border-rule px-2 py-1 text-muted hover:border-ink hover:text-ink"
        >
          Copy ID
        </button>
      </div>
      <p className="mt-3 type-h2 text-ink">{exp.title}</p>
      <p className="type-label mt-3 text-muted">{formatDateTime(exp.timestamp)} IST</p>
      {exp.notes && <p className="measure mt-5 type-body text-muted">{exp.notes}</p>}

      {exp.metrics && (
        <section className="mt-10" aria-label="Metrics">
          <p className="type-label mb-3 text-muted">
            Metrics · mean ± std over {c.seeds} <Term term="seed">seed{c.seeds > 1 ? 's' : ''}</Term>
          </p>
          <div className="grid grid-cols-2 border-t border-rule">
            {METRIC_ROWS.map((m, i) => {
              const [mean, std] = m.format(exp.metrics![m.key])
              return (
                <div key={m.key} className={`border-b border-rule py-4 ${i % 2 === 0 ? 'pr-4' : 'border-l pl-4'}`}>
                  <p className="type-small text-muted">{m.label}</p>
                  <p className="mt-1.5 type-metric text-ink">
                    {mean}
                    <span className="ml-2 type-small text-muted">{std}</span>
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="mt-10" aria-label="Configuration">
        <p className="type-label mb-1 text-muted">Configuration</p>
        <dl className="border-t border-rule">
          <Row label="Dataset" value={`${DATASETS[c.dataset].name} (${DATASETS[c.dataset].code})`} />
          <Row label="Models" value={c.models.map((m) => MODELS[m].name).join(', ')} />
          <Row label="Features" value={c.features} />
          <Row label="PCA dims" term="pca" value={c.pcaDims ?? dash} />
          <Row label="Encoding" term="encoding" value={c.encoding ?? dash} />
          <Row label="Qubits" term="qubit" value={c.qubits ?? dash} />
          <Row label="Circuit depth" term="circuit depth" value={c.circuitDepth ?? dash} />
          <Row label="Entanglement" value={c.entanglement ?? dash} />
          <Row label="Backend" term="backend" value={BACKENDS[c.backend].name} />
          <Row label="Seed" term="seed" value={`${c.seed} · ${c.seeds} run${c.seeds > 1 ? 's' : ''}`} />
        </dl>
      </section>

      {quantum && (
        <section className="mt-10" aria-label="Noise parameters">
          <p className="type-label mb-1 text-muted">
            <Term term="noise">Noise</Term> parameters
          </p>
          {n && (n.gateError2q > 0 || n.t1Us !== null) ? (
            <dl className="border-t border-rule">
              <Row label="T1" term="t1" value={n.t1Us !== null ? `${n.t1Us} µs` : dash} />
              <Row label="T2" term="t2" value={n.t2Us !== null ? `${n.t2Us} µs` : dash} />
              <Row label="1Q gate error" term="gate error" value={`${n.gateError1q}%`} />
              <Row label="2Q gate error" term="gate error" value={`${n.gateError2q}%`} />
              <Row label="Readout error" term="readout error" value={`${n.readoutError}%`} />
              <Row label="Shots" term="shots" value={n.shots?.toLocaleString('en-US') ?? dash} />
            </dl>
          ) : (
            <p className="border-t border-rule py-3 type-ui text-muted">
              Noiseless <Term term="simulator">simulation</Term>.
            </p>
          )}
        </section>
      )}
    </div>
  )
}

function ExperimentDetail({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  const { version } = useDataVersion()
  const { rerunExperiment } = useAppActions()
  const [rerunning, setRerunning] = useState(false)
  const exp = useResource((signal) => api.getExperiment(id, { signal }), [id, version])

  const rerun = async () => {
    setRerunning(true)
    const created = await rerunExperiment(id)
    setRerunning(false)
    if (created) onOpen(created.id)
  }

  if (exp.status === 'error') {
    return (
      <div className="px-8 pt-16">
        <EmptyState
          tone="error"
          title={`${id} is unavailable.`}
          body={exp.error.message}
          action={<Button variant="outline" size="sm" onClick={exp.reload}>Try again</Button>}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1" aria-busy={exp.status === 'loading'}>
        {exp.status === 'success' ? (
          <ExperimentBody exp={exp.data} />
        ) : (
          <div className="px-8 pt-8">
            <Skeleton width={18} />
            <div className="mt-4">
              <Skeleton width="60%" height={44} />
            </div>
            <div className="mt-4">
              <Skeleton width="40%" height={28} />
            </div>
            <div className="mt-10 flex flex-col gap-3">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} width="100%" height={18} />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="sticky bottom-0 flex items-center gap-3 border-t border-rule bg-bg px-8 py-5">
        <Button onClick={rerun} disabled={exp.status !== 'success' || rerunning}>
          {rerunning ? 'Re-running…' : 'Re-run experiment'}
        </Button>
        <span className="type-label text-muted">Same config · new ID</span>
      </div>
    </div>
  )
}
