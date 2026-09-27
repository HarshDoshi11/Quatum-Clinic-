import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { api, useResource } from '@/api'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Term } from '@/components/ui/Term'
import { useToast } from '@/components/ui/Toast'
import { BACKENDS, DATASETS, MODELS } from '@/lib/domain'
import { formatDateTime, formatStd } from '@/lib/format'
import type { GlossaryKey } from '@/lib/glossary'
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
  { key: 'trainTimeS', label: 'Train time', format: (m) => [`${m.mean} s`, `±${m.std} s`] },
  { key: 'inferenceMs', label: 'Inference', format: (m) => [`${m.mean} ms`, `±${m.std} ms`] },
]

function Row({ label, value, term }: { label: string; value: ReactNode; term?: GlossaryKey }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-rule py-2.5">
      <dt className="text-[13px] text-muted">{term ? <Term term={term}>{label}</Term> : label}</dt>
      <dd className="num text-right text-[13px] text-ink">{value}</dd>
    </div>
  )
}

const dash = '—'

function ExperimentBody({ exp }: { exp: Experiment }) {
  const c = exp.config
  const quantum = c.qubits !== null
  const n = c.noise

  return (
    <div className="px-8 pt-8 pb-10">
      <p className="label-mono text-muted">
        {exp.kind} · {exp.status} · {DATASETS[exp.dataset].code}
      </p>
      <h2 className="num mt-4 text-[44px] leading-none tracking-[-0.02em] text-ink">{exp.id}</h2>
      <p className="mt-3 font-serif text-[28px] leading-tight text-ink">{exp.title}</p>
      <p className="label-mono mt-3 text-muted">{formatDateTime(exp.timestamp)} IST</p>
      {exp.notes && <p className="mt-5 max-w-[46ch] text-[14px] leading-6 text-muted">{exp.notes}</p>}

      {exp.metrics && (
        <section className="mt-10" aria-label="Metrics">
          <p className="label-mono mb-3 text-muted">
            Metrics · mean ± std over {c.seeds} seed{c.seeds > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-2 border-t border-rule">
            {METRIC_ROWS.map((m, i) => {
              const [mean, std] = m.format(exp.metrics![m.key])
              return (
                <div key={m.key} className={`border-b border-rule py-4 ${i % 2 === 0 ? 'pr-4' : 'border-l pl-4'}`}>
                  <p className="text-[12.5px] text-muted">{m.label}</p>
                  <p className="num mt-1.5 text-[26px] leading-none text-ink">
                    {mean}
                    <span className="ml-2 text-[12px] text-muted">{std}</span>
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="mt-10" aria-label="Configuration">
        <p className="label-mono mb-1 text-muted">Configuration</p>
        <dl className="border-t border-rule">
          <Row label="Dataset" value={`${DATASETS[c.dataset].name} (${DATASETS[c.dataset].code})`} />
          <Row label="Models" value={c.models.map((m) => MODELS[m].name).join(', ')} />
          <Row label="Features" value={c.features} />
          <Row label="PCA dims" term="pca" value={c.pcaDims ?? dash} />
          <Row label="Encoding" term="encoding" value={c.encoding ?? dash} />
          <Row label="Qubits" term="qubit" value={c.qubits ?? dash} />
          <Row label="Circuit depth" term="circuit depth" value={c.circuitDepth ?? dash} />
          <Row label="Entanglement" value={c.entanglement ?? dash} />
          <Row label="Backend" value={BACKENDS[c.backend].name} />
          <Row label="Seed" value={`${c.seed} · ${c.seeds} run${c.seeds > 1 ? 's' : ''}`} />
        </dl>
      </section>

      {quantum && (
        <section className="mt-10" aria-label="Noise parameters">
          <p className="label-mono mb-1 text-muted">Noise parameters</p>
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
            <p className="border-t border-rule py-3 text-[13px] text-muted">Noiseless simulation.</p>
          )}
        </section>
      )}
    </div>
  )
}

function ExperimentDetail({ id, onOpen }: { id: string; onOpen: (id: string) => void }) {
  const { version, invalidate } = useDataVersion()
  const { toast } = useToast()
  const [rerunning, setRerunning] = useState(false)
  const exp = useResource((signal) => api.getExperiment(id, { signal }), [id, version])

  const rerun = async () => {
    setRerunning(true)
    try {
      const created = await api.rerunExperiment(id)
      toast(`${created.id} · re-run of ${id} complete`, 'accent')
      invalidate()
      onOpen(created.id)
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Re-run failed', 'error')
    } finally {
      setRerunning(false)
    }
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
        <span className="label-mono text-muted">Same config · new ID</span>
      </div>
    </div>
  )
}
