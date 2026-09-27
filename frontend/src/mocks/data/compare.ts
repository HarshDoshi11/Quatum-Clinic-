/** Advantage Observatory benchmark: 6 models × 5 seeds. */
import { MODEL_ORDER, MODELS } from '../../lib/domain'
import type { CompareResponse, ComparisonRow, DatasetId, ResourcePoint, SeedPoint } from '../../types'
import { ANCHORS, BEST_OVERALL, BEST_QUANTUM, SEEDS, modelMetrics } from './canon'
import { evolutionSweep } from './sweeps'
import { EXPERIMENT_IDS, type DatasetExperimentIds } from './ids'
import { hashSeed, round, samplesWithStats } from './math'

const RUN_ID: Record<string, keyof DatasetExperimentIds> = {
  vqc: 'vqcIdealRun',
  qsvm: 'qsvmRun',
  logreg: 'logregRun',
  svm: 'svmRun',
  rf: 'rfRun',
  xgboost: 'xgboostRun',
}

export function compare(dataset: DatasetId): CompareResponse {
  const ids = EXPERIMENT_IDS[dataset]
  const rows: ComparisonRow[] = MODEL_ORDER.map((model) => {
    const a = ANCHORS[dataset][model]
    return {
      model,
      family: MODELS[model].family,
      experimentId: ids[RUN_ID[model]] ?? ids.benchmark,
      metrics: modelMetrics(dataset, model),
      qubits: a.qubits,
      circuitDepth: a.circuitDepth,
    }
  })

  // Quantum resource scatter: VQC configs from the circuit search + QSVM at 4/6/8 qubits.
  const evo = evolutionSweep(dataset)
  const qsvm = ANCHORS[dataset].qsvm
  const resources: ResourcePoint[] = [
    ...evo.configs
      .filter((c) => c.encoding === 'angle')
      .map((c) => ({ id: c.id, model: 'vqc' as const, qubits: c.qubits, circuitDepth: c.circuitDepth, auc: c.auc })),
    { id: 'QSVM-4', model: 'qsvm', qubits: 4, circuitDepth: 2, auc: qsvm.auc },
    { id: 'QSVM-6', model: 'qsvm', qubits: 6, circuitDepth: 2, auc: round(qsvm.auc - 0.003) },
    { id: 'QSVM-8', model: 'qsvm', qubits: 8, circuitDepth: 2, auc: round(qsvm.auc - 0.008) },
  ]

  const baselines = MODEL_ORDER.filter((m) => MODELS[m].family === 'classical').map((model) => ({
    model,
    auc: ANCHORS[dataset][model].auc,
  }))

  const stability: SeedPoint[] = MODEL_ORDER.flatMap((model) => {
    const a = ANCHORS[dataset][model]
    return samplesWithStats(SEEDS, a.auc, a.aucStd, hashSeed(`${dataset}-${model}`)).map((auc, i) => ({
      model,
      seed: i + 1,
      auc: round(auc, 4),
    }))
  })

  const q = ANCHORS[dataset][BEST_QUANTUM]
  const c = ANCHORS[dataset][BEST_OVERALL]
  const delta = q.auc - c.auc
  const pooled = Math.sqrt(q.aucStd ** 2 + c.aucStd ** 2)
  const withinNoise = Math.abs(delta) < pooled

  return {
    dataset,
    experimentId: ids.benchmark,
    seeds: SEEDS,
    rows,
    resources,
    baselines,
    stability,
    takeaway: withinNoise
      ? `${MODELS[BEST_QUANTUM].name} trails ${MODELS[BEST_OVERALL].name} by ${Math.abs(delta).toFixed(3)} AUC — within seed noise (±${pooled.toFixed(3)}).`
      : `${MODELS[BEST_QUANTUM].name} ${delta > 0 ? 'leads' : 'trails'} ${MODELS[BEST_OVERALL].name} by ${Math.abs(delta).toFixed(3)} AUC.`,
  }
}
