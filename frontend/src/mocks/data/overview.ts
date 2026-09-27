/** Overview page: status strip values, findings, backends, recent runs. */
import { MODELS, testSize } from '../../lib/domain'
import type { DatasetId, Experiment, ExperimentSummary, Finding, OverviewResponse, SystemStatus } from '../../types'
import { ABSTAINED, ANCHORS, BEST_OVERALL, BEST_QUANTUM, SAFE_SENSITIVITY, SEEDS, toleranceGateError2q } from './canon'
import { BACKEND_STATUS } from './hardware'
import { EXPERIMENT_IDS } from './ids'

/** Unicode minus for negative numbers in display strings. */
const signed = (x: number, dp: number): string => `${x < 0 ? '−' : '+'}${Math.abs(x).toFixed(dp)}`

export function toSummary(e: Experiment): ExperimentSummary {
  return {
    id: e.id,
    kind: e.kind,
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
  const ids = EXPERIMENT_IDS[dataset]
  const q = ANCHORS[dataset][BEST_QUANTUM]
  const c = ANCHORS[dataset][BEST_OVERALL]
  const own = experiments.filter((e) => e.dataset === dataset)
  const last = own.reduce((a, b) => (b.timestamp > a.timestamp ? b : a), own[0])
  const newest = experiments.reduce((a, b) => (b.timestamp > a.timestamp ? b : a), experiments[0])
  return {
    dataset,
    activeBackend: { id: 'ideal-sim', kind: 'SIM', mode: 'IDEAL', qubits: 4 },
    bestQuantum: { model: BEST_QUANTUM, auc: { mean: q.auc, std: q.aucStd }, experimentId: ids.qsvmRun, qubits: q.qubits ?? 4 },
    bestOverall: { model: BEST_OVERALL, auc: { mean: c.auc, std: c.aucStd }, experimentId: ids.xgboostRun },
    lastExperiment: { id: last.id, timestamp: last.timestamp },
    updatedAt: newest.timestamp,
  }
}

export function findings(dataset: DatasetId): Finding[] {
  const ids = EXPERIMENT_IDS[dataset]
  const q = ANCHORS[dataset][BEST_QUANTUM]
  const c = ANCHORS[dataset][BEST_OVERALL]
  const delta = q.auc - c.auc
  const pooled = Math.sqrt(q.aucStd ** 2 + c.aucStd ** 2)
  const tolerance = toleranceGateError2q(dataset)
  const abstainRate = ABSTAINED[dataset] / testSize(dataset)

  return [
    {
      id: 'advantage',
      label: 'Quantum vs classical',
      value: `Δ ${signed(delta, 3)} AUC`,
      summary: `${MODELS[BEST_QUANTUM].name} ${q.auc.toFixed(3)} vs ${MODELS[BEST_OVERALL].name} ${c.auc.toFixed(3)} — ${Math.abs(delta) < pooled ? 'within noise' : 'beyond noise'} across ${SEEDS} seeds.`,
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
    dataset,
    status: systemStatus(dataset, experiments),
    findings: findings(dataset),
    backends: BACKEND_STATUS,
    recentExperiments,
  }
}
