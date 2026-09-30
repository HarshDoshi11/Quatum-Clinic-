/** Overview page: status strip values, findings, backends, recent runs. */
import { MODELS, testSize } from '../../lib/domain'
import type { DatasetId, Experiment, ExperimentSummary, Finding, OverviewResponse, SystemStatus } from '../../types'
import { ABSTAINED, SAFE_SENSITIVITY, SEEDS, SIMULATED, toleranceGateError2q } from './canon'
import { BACKEND_STATUS } from './hardware'
import { EXPERIMENT_IDS, runIdFor } from './ids'
import { bestModel, referenceResult } from './results'

/** Unicode minus for negative numbers in display strings. */
const signed = (x: number, dp: number): string => `${x < 0 ? '−' : '+'}${Math.abs(x).toFixed(dp)}`

export function toSummary(e: Experiment): ExperimentSummary {
  return {
    id: e.id,
    kind: e.kind,
    configKey: e.configKey,
    title: e.title,
    dataset: e.dataset,
    model: e.model,
    family: e.family,
    backend: e.backend,
    qubits: e.qubits,
    auc: e.auc,
    timestamp: e.timestamp,
    status: e.status,
  }
}

export function systemStatus(dataset: DatasetId, experiments: Experiment[]): SystemStatus {
  const qm = bestModel(dataset, 'quantum')
  const om = bestModel(dataset)
  const q = referenceResult(dataset, qm)
  const c = referenceResult(dataset, om)
  const own = experiments.filter((e) => e.dataset === dataset)
  const last = own.reduce((a, b) => (b.timestamp > a.timestamp ? b : a), own[0])
  const newest = experiments.reduce((a, b) => (b.timestamp > a.timestamp ? b : a), experiments[0])
  return {
    dataset,
    activeBackend: { id: 'ideal-sim', kind: 'SIM', mode: 'IDEAL', qubits: 4 },
    bestQuantum: { model: qm, auc: q.auc, experimentId: runIdFor(dataset, qm), qubits: q.config.qubits ?? 4 },
    bestOverall: { model: om, auc: c.auc, experimentId: runIdFor(dataset, om) },
    lastExperiment: { id: last.id, timestamp: last.timestamp },
    updatedAt: newest.timestamp,
  }
}

export function findings(dataset: DatasetId): Finding[] {
  const ids = EXPERIMENT_IDS[dataset]
  const qm = bestModel(dataset, 'quantum')
  const cm = bestModel(dataset, 'classical')
  const q = referenceResult(dataset, qm).auc
  const c = referenceResult(dataset, cm).auc
  const delta = q.mean - c.mean
  const pooled = Math.sqrt(q.std ** 2 + c.std ** 2)
  const tolerance = toleranceGateError2q(dataset)
  const abstainRate = ABSTAINED[dataset] / testSize(dataset)

  return [
    {
      id: 'advantage',
      label: 'Quantum vs classical',
      value: `Δ ${signed(delta, 3)} AUC`,
      summary: `${MODELS[qm].name} ${q.mean.toFixed(3)} vs ${MODELS[cm].name} ${c.mean.toFixed(3)} — ${Math.abs(delta) <= pooled ? 'within seed noise' : 'a gap beyond seed noise'} across ${SEEDS} seeds.`,
      link: { label: 'View advantage', path: '/advantage' },
      experimentId: ids.benchmark,
    },
    {
      id: 'noise',
      label: 'Noise tolerance',
      value: `${tolerance.toFixed(1)}%`,
      summary: `Sensitivity holds ≥ ${Math.round(SAFE_SENSITIVITY * 100)}% up to this two-qubit gate error.`,
      link: { label: 'View hardware lab', path: '/hardware' },
      experimentId: ids.noiseSweep,
    },
    {
      id: 'trust',
      label: 'Trust',
      value: `${(abstainRate * 100).toFixed(1)}%`,
      summary: 'Of test patients abstained on. Zero high-confidence misses.',
      link: { label: 'View trust', path: '/predict' },
      experimentId: ids.qsvmRun,
    },
  ]
}

export function overview(dataset: DatasetId, experiments: Experiment[]): OverviewResponse {
  const recentExperiments = experiments
    .filter((e) => e.dataset === dataset && e.kind === 'run')
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5)
    .map(toSummary)
  return {
    source: SIMULATED,
    dataset,
    status: systemStatus(dataset, experiments),
    findings: findings(dataset),
    backends: BACKEND_STATUS,
    recentExperiments,
  }
}
