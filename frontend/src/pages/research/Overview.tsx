import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { api, useResource } from '@/api'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExperimentTag } from '@/components/ui/ExperimentTag'
import { Glossed } from '@/components/ui/Glossed'
import { HairlineTable, type Column } from '@/components/ui/HairlineTable'
import { Metric } from '@/components/ui/Metric'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { Term } from '@/components/ui/Term'
import { useAppActions } from '@/features/actions'
import { useExperimentDrawer } from '@/features/experiments/ExperimentDrawer'
import { BlochPanel } from '@/features/overview/BlochPanel'
import { Pipeline } from '@/features/overview/Pipeline'
import { BACKENDS, MODELS } from '@/lib/domain'
import { formatAuc, formatStd, formatTime } from '@/lib/format'
import type { RouteMeta } from '@/routes'
import { useDataVersion } from '@/state/dataVersion'
import { useDataset } from '@/state/dataset'
import type { BackendStatus, ExperimentSummary, Finding, ModelId } from '@/types'

/** Model name wrapped in its glossary term where one exists. */
function ModelName({ model }: { model: ModelId }) {
  const name = MODELS[model].name
  return model === 'vqc' || model === 'qsvm' ? <Term term={model}>{name}</Term> : <>{name}</>
}

// ─── Findings ───────────────────────────────────────────────

function FindingColumn({ finding, first }: { finding: Finding; first: boolean }) {
  return (
    <article className={`flex flex-col pt-6 pb-2 ${first ? 'pr-8' : 'border-l border-rule px-8'}`}>
      <p className="label-mono text-muted">{finding.label}</p>
      <p className="num mt-5 text-[clamp(26px,2.6vw,40px)] leading-none tracking-[-0.02em] whitespace-nowrap text-accent">
        {finding.value}
      </p>
      <p className="mt-5 max-w-[34ch] text-[14.5px] leading-6 text-ink">
        <Glossed text={finding.summary} />
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Link to={finding.link.path} className="label-mono text-ink underline-offset-4 hover:underline">
          {finding.link.label} ↗
        </Link>
        <ExperimentTag id={finding.experimentId} />
      </div>
    </article>
  )
}

function FindingSkeleton({ first }: { first: boolean }) {
  return (
    <div className={`flex flex-col gap-5 pt-6 ${first ? 'pr-8' : 'border-l border-rule px-8'}`} aria-hidden="true">
      <Skeleton width={16} />
      <Skeleton width="60%" height={40} />
      <Skeleton width="90%" height={40} />
      <Skeleton width={14} />
    </div>
  )
}

// ─── Recent experiments ─────────────────────────────────────

const RECENT_COLUMNS: Column<ExperimentSummary>[] = [
  { key: 'id', header: <Term term="experiment">Experiment</Term>, width: '16%', mono: true, render: (e) => <span className="text-ink">{e.id}</span> },
  {
    key: 'model',
    header: 'Model',
    width: '22%',
    render: (e) => (
      <span className="flex items-center gap-2.5">
        <span className={`block h-[7px] w-[7px] ${e.family === 'quantum' ? 'bg-accent' : 'bg-classical'}`} aria-hidden="true" />
        {e.model ? MODELS[e.model].name : e.title}
      </span>
    ),
  },
  { key: 'qubits', header: <Term term="qubit">Qubits</Term>, width: '12%', mono: true, render: (e) => (e.qubits ? `${e.qubits}q` : '—') },
  { key: 'backend', header: <Term term="backend">Backend</Term>, width: '22%', mono: true, render: (e) => BACKENDS[e.backend].name },
  {
    key: 'auc',
    header: <Term>AUC</Term>,
    width: '14%',
    align: 'right',
    mono: true,
    render: (e) => <span className="text-ink">{e.auc !== null ? formatAuc(e.auc) : '—'}</span>,
  },
  { key: 'time', header: 'Time', width: '14%', align: 'right', mono: true, render: (e) => <span className="text-muted">{formatTime(e.timestamp)}</span> },
]

// ─── Backends ───────────────────────────────────────────────

const KIND_LABEL: Record<BackendStatus['kind'], ReactNode> = {
  simulator: <Term term="simulator">Simulator</Term>,
  'fake-hardware': 'Fake hardware',
  hardware: (
    <>
      Hardware · <Term term="qpu">QPU</Term>
    </>
  ),
}

function BackendColumn({ backend, first }: { backend: BackendStatus; first: boolean }) {
  const live = backend.status === 'live'
  return (
    <div className={`pt-6 ${first ? 'pr-6' : 'border-l border-rule px-6'}`}>
      <p className={`label-mono flex items-center gap-2 ${live ? 'text-ink' : 'text-muted'}`}>
        <span className={`block h-[6px] w-[6px] ${live ? 'bg-ink' : 'border border-muted'}`} aria-hidden="true" />
        {live ? 'Live' : 'Offline'}
      </p>
      <p className={`mt-4 text-[17px] ${live ? 'text-ink' : 'text-muted'}`}>{backend.name}</p>
      <p className="label-mono mt-2 text-muted">
        {KIND_LABEL[backend.kind]} · {backend.qubits}q
      </p>
      <p className="mt-1 text-[13px] text-muted">{backend.note}</p>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────

export function Overview({ route }: { route: RouteMeta }) {
  const { datasetId, dataset } = useDataset()
  const { version } = useDataVersion()
  const { openExperiment } = useExperimentDrawer()
  const { runPrediction, newExperiment } = useAppActions()
  const overview = useResource((signal) => api.getOverview(datasetId, { signal }), [datasetId, version])
  const detail = useResource((signal) => api.getDataset(datasetId, { signal }), [datasetId])
  const data = overview.data
  const best = data?.status.bestQuantum

  return (
    <Page label={route.label}>
      {/* Hero */}
      <div className="grid-12 gap-y-16">
        <PageItem as="header" className="col-span-12 flex flex-col xl:col-span-7">
          <PageHeader route={route} headlineClassName="text-[clamp(44px,6vw,80px)] xl:text-[clamp(56px,4.45vw,112px)]" />
          <div className="mt-16">
            {overview.status === 'error' ? (
              <EmptyState tone="error" title="Couldn't load results." body={overview.error.message} />
            ) : best ? (
              <Metric
                size="hero"
                tone="accent"
                value={best.auc.mean}
                format={formatAuc}
                caption={
                  <>
                    Best quantum <Term>AUC</Term> · <ModelName model={best.model} /> · {formatStd(best.auc.std)}
                  </>
                }
              />
            ) : (
              <div aria-hidden="true">
                <Skeleton width="3.2em" height="0.9em" className="font-mono text-[clamp(72px,7vw,112px)]" />
                <div className="mt-3">
                  <Skeleton width={28} />
                </div>
              </div>
            )}
            <div className="mt-10 flex flex-wrap gap-3">
              <Button onClick={runPrediction}>Run a prediction →</Button>
              <Button variant="outline" onClick={newExperiment}>
                New experiment →
              </Button>
            </div>
          </div>
        </PageItem>

        <PageItem className="col-span-12 max-w-[620px] xl:col-span-5 xl:max-w-none">
          <BlochPanel pca={detail.data?.preprocessing.pca} sampleEncoding={detail.data?.preprocessing.sampleEncoding} />
        </PageItem>
      </div>

      {/* 01 — Findings */}
      <PageItem as="section" className="mt-28">
        <div data-tour="findings">
          <SectionHeader
            index="01"
            title="Latest findings"
            plain="Three headline results: quantum roughly ties the best classical model, it stays safe only below a certain hardware error rate, and it refuses to guess on a few unusual patients."
          />
          <div className="grid grid-cols-3">
            {data
              ? data.findings.map((f, i) => <FindingColumn key={f.id} finding={f} first={i === 0} />)
              : [0, 1, 2].map((i) => <FindingSkeleton key={i} first={i === 0} />)}
          </div>
        </div>
      </PageItem>

      {/* 02 — Pipeline */}
      <PageItem as="section" className="mt-28">
        <SectionHeader
          index="02"
          title="Hybrid pipeline"
          plain="A normal computer cleans and shrinks the patient data, a quantum circuit turns it into qubit states and reads them, then a normal computer scores the result."
        />
        <p className="mt-5 max-w-[60ch] text-[14.5px] leading-6 text-muted">
          Classical stages prepare and score the data; the quantum stages <Term term="encoding">encode</Term> each patient
          into a 4-<Term term="qubit">qubit</Term> state and take a <Term term="measurement">measurement</Term>.
        </p>
        <Pipeline dataset={dataset} />
      </PageItem>

      {/* 03 — Recent experiments */}
      <PageItem as="section" className="mt-28">
        <div data-tour="experiments">
          <SectionHeader
            index="03"
            title="Recent experiments"
            plain="Every run is saved with an ID. Click one to see exactly which data, model and settings produced its score, or run it again."
            aside={<span className="label-mono text-muted">Click a row for details</span>}
          />
          <div className="mt-4">
            <HairlineTable
              caption={`Recent experiments on ${dataset.name}`}
              columns={RECENT_COLUMNS}
              rows={data?.recentExperiments}
              loading={overview.status === 'loading'}
              rowKey={(e) => e.id}
              onRowClick={(e) => openExperiment(e.id)}
              rowLabel={(e) => `Open ${e.id}, ${e.title}`}
              empty={
                <span>
                  No experiments yet ·{' '}
                  <Link to="/train" className="text-ink underline underline-offset-4">
                    Train a model
                  </Link>
                </span>
              }
            />
          </div>
        </div>
      </PageItem>

      {/* 04 — Backends */}
      <PageItem as="section" className="mt-28">
        <div data-tour="backends">
          <SectionHeader
            index="04"
            title={<Term term="backend">Backends</Term>}
            plain="The machines our quantum circuits can run on: perfect simulators, simulators with realistic noise, and a real IBM quantum chip (currently offline)."
          />
          <div className="grid grid-cols-4">
            {data
              ? data.backends.map((b, i) => <BackendColumn key={b.id} backend={b} first={i === 0} />)
              : [0, 1, 2, 3].map((i) => (
                  <div key={i} className={`flex flex-col gap-3 pt-6 ${i === 0 ? 'pr-6' : 'border-l border-rule px-6'}`} aria-hidden="true">
                    <Skeleton width={6} />
                    <Skeleton width={14} height={20} />
                    <Skeleton width={18} />
                  </div>
                ))}
          </div>
        </div>
      </PageItem>
    </Page>
  )
}
