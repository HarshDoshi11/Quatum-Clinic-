/** Experiment registry: every experiment ID shown anywhere resolves here. */
import { DATASETS, MODELS } from '../../lib/domain'
import type {
  BackendId,
  DatasetId,
  Encoding,
  Entanglement,
  Experiment,
  ExperimentKind,
  ExperimentMetrics,
  ModelId,
  NoiseParams,
} from '../../types'
import { ANCHORS, NOISE_PROFILES, SEEDS, modelMetrics } from './canon'
import { EXPERIMENT_IDS } from './ids'

/** Features kept after selection (see preprocessing). */
export const SELECTED_FEATURES: Record<DatasetId, number> = { wdbc: 16, heart: 13 }

/** VQC, 4 qubits on FakeBackend-1 — the most recent hardware-noise run. */
export const HARDWARE_RUN_AUC: Record<DatasetId, number> = { wdbc: 0.902, heart: 0.881 }

/** "2026-09-27 14:32" (IST) → ISO-8601. */
const at = (when: string): string => `${when.replace(' ', 'T')}:00+05:30`

export const NOISE_FOR_BACKEND: Partial<Record<BackendId, NoiseParams>> = {
  'ideal-sim': NOISE_PROFILES.ideal,
  'noisy-sim': NOISE_PROFILES.noisySim,
  'fake-backend-1': NOISE_PROFILES.fakeBackend1,
  'fake-backend-2': NOISE_PROFILES.fakeBackend2,
}

interface RunSpec {
  id: string
  dataset: DatasetId
  model: ModelId
  backend: BackendId
  timestamp: string
  qubits?: number
  circuitDepth?: number
  auc?: number
  notes: string
}

function run(spec: RunSpec): Experiment {
  const info = MODELS[spec.model]
  const anchor = ANCHORS[spec.dataset][spec.model]
  const quantum = info.family === 'quantum'
  const qubits = quantum ? (spec.qubits ?? anchor.qubits) : null
  const circuitDepth = quantum ? (spec.circuitDepth ?? anchor.circuitDepth) : null
  const auc = spec.auc ?? anchor.auc
  const encoding: Encoding | null = quantum ? 'angle' : null
  const entanglement: Entanglement | null = quantum ? (spec.model === 'qsvm' ? 'full' : 'linear') : null
  const metrics: ExperimentMetrics = modelMetrics(spec.dataset, spec.model, auc)
  const backendLabel = quantum ? spec.backend : 'cpu'

  return {
    id: spec.id,
    kind: 'run',
    title: quantum ? `${info.name} · ${qubits}q` : info.name,
    dataset: spec.dataset,
    model: spec.model,
    family: info.family,
    backend: backendLabel,
    qubits,
    auc,
    timestamp: spec.timestamp,
    status: 'complete',
    config: {
      dataset: spec.dataset,
      models: [spec.model],
      features: SELECTED_FEATURES[spec.dataset],
      pcaDims: quantum ? qubits : null,
      encoding,
      qubits,
      circuitDepth,
      entanglement,
      backend: backendLabel,
      noise: quantum ? (NOISE_FOR_BACKEND[spec.backend] ?? null) : null,
      seed: 42,
      seeds: SEEDS,
    },
    metrics,
    notes: spec.notes,
  }
}

interface StudySpec {
  id: string
  dataset: DatasetId
  kind: Exclude<ExperimentKind, 'run'>
  title: string
  models: ModelId[]
  model: ModelId | null
  backend: BackendId
  qubits: number | null
  circuitDepth: number | null
  timestamp: string
  notes: string
}

function study(spec: StudySpec): Experiment {
  const family = spec.model ? MODELS[spec.model].family : null
  const quantum = spec.models.some((m) => MODELS[m].family === 'quantum')
  return {
    id: spec.id,
    kind: spec.kind,
    title: spec.title,
    dataset: spec.dataset,
    model: spec.model,
    family,
    backend: spec.backend,
    qubits: spec.qubits,
    auc: spec.model ? ANCHORS[spec.dataset][spec.model].auc : null,
    timestamp: spec.timestamp,
    status: 'complete',
    config: {
      dataset: spec.dataset,
      models: spec.models,
      features: SELECTED_FEATURES[spec.dataset],
      pcaDims: quantum ? spec.qubits : null,
      encoding: quantum ? 'angle' : null,
      qubits: spec.qubits,
      circuitDepth: spec.circuitDepth,
      entanglement: quantum ? 'linear' : null,
      backend: spec.backend,
      noise: NOISE_FOR_BACKEND[spec.backend] ?? null,
      seed: 42,
      seeds: SEEDS,
    },
    metrics: spec.model ? modelMetrics(spec.dataset, spec.model) : null,
    notes: spec.notes,
  }
}

const ALL_MODELS: ModelId[] = ['vqc', 'qsvm', 'logreg', 'svm', 'rf', 'xgboost']

type ScheduleKey =
  | 'svm' | 'rf' | 'logreg' | 'xgboost' | 'vqcIdeal' | 'qsvm' | 'vqcHardware'
  | 'benchmark' | 'smallData' | 'scalability' | 'evolution' | 'noiseSweep' | 'crossModality'

function datasetExperiments(dataset: DatasetId, schedule: Partial<Record<ScheduleKey, string>> & Record<Exclude<ScheduleKey, 'crossModality'>, string>): Experiment[] {
  const ids = EXPERIMENT_IDS[dataset]
  const name = DATASETS[dataset].code
  const list: Experiment[] = [
    run({ id: ids.svmRun, dataset, model: 'svm', backend: 'cpu', timestamp: at(schedule.svm), notes: 'RBF kernel, C and γ tuned by 5-fold CV.' }),
    run({ id: ids.rfRun, dataset, model: 'rf', backend: 'cpu', timestamp: at(schedule.rf), notes: '500 trees, balanced class weights.' }),
    run({ id: ids.logregRun, dataset, model: 'logreg', backend: 'cpu', timestamp: at(schedule.logreg), notes: 'L2-regularised baseline.' }),
    run({ id: ids.vqcIdealRun, dataset, model: 'vqc', backend: 'ideal-sim', timestamp: at(schedule.vqcIdeal), notes: 'Best VQC configuration from the circuit search.' }),
    run({ id: ids.xgboostRun, dataset, model: 'xgboost', backend: 'cpu', timestamp: at(schedule.xgboost), notes: 'Best overall model.' }),
    run({ id: ids.qsvmRun, dataset, model: 'qsvm', backend: 'noisy-sim', timestamp: at(schedule.qsvm), notes: 'ZZ feature-map kernel; best quantum model.' }),
    run({
      id: ids.vqcHardwareRun,
      dataset,
      model: 'vqc',
      backend: 'fake-backend-1',
      qubits: 4,
      circuitDepth: 3,
      auc: HARDWARE_RUN_AUC[dataset],
      timestamp: at(schedule.vqcHardware),
      notes: 'Hardware-noise check on FakeBackend-1 calibration data.',
    }),
    study({ id: ids.benchmark, dataset, kind: 'benchmark', title: `Benchmark · ${name} · 6 models`, models: ALL_MODELS, model: null, backend: 'noisy-sim', qubits: 4, circuitDepth: 2, timestamp: at(schedule.benchmark), notes: 'Quantum vs classical, 5 seeds, identical splits.' }),
    study({ id: ids.smallData, dataset, kind: 'sweep', title: 'Small-data sweep', models: ['qsvm', 'vqc', 'xgboost', 'logreg'], model: null, backend: 'ideal-sim', qubits: 4, circuitDepth: 2, timestamp: at(schedule.smallData), notes: 'Training sizes 25 → all, 5 seeds each.' }),
    study({ id: ids.scalability, dataset, kind: 'sweep', title: 'Scalability sweep · VQC 4→12q', models: ['vqc'], model: 'vqc', backend: 'ideal-sim', qubits: 12, circuitDepth: 3, timestamp: at(schedule.scalability), notes: 'Transpiled depth, gate count, runtime and AUC vs qubits.' }),
    study({ id: ids.evolution, dataset, kind: 'sweep', title: 'Circuit search · 20 configs', models: ['vqc'], model: 'vqc', backend: 'ideal-sim', qubits: 8, circuitDepth: 4, timestamp: at(schedule.evolution), notes: 'Encoding × qubits × depth × entanglement.' }),
    study({ id: ids.noiseSweep, dataset, kind: 'sweep', title: 'Noise robustness sweep · QSVM', models: ['qsvm'], model: 'qsvm', backend: 'fake-backend-1', qubits: 4, circuitDepth: 2, timestamp: at(schedule.noiseSweep), notes: 'Gate error, T1/T2, readout and data corruption sweeps.' }),
  ]
  if (ids.crossModality) {
    list.push(
      study({ id: ids.crossModality, dataset, kind: 'sweep', title: 'Cross-modality study · 5 signals', models: ['qsvm'], model: 'qsvm', backend: 'noisy-sim', qubits: 4, circuitDepth: 2, timestamp: at(schedule.crossModality ?? schedule.noiseSweep), notes: 'Each modality alone vs all combined.' }),
    )
  }
  return list
}

export const EXPERIMENTS: Experiment[] = [
  ...datasetExperiments('heart', {
    svm: '2026-09-25 08:55',
    rf: '2026-09-25 09:20',
    logreg: '2026-09-25 09:40',
    xgboost: '2026-09-25 10:05',
    vqcIdeal: '2026-09-25 10:50',
    qsvm: '2026-09-25 11:35',
    vqcHardware: '2026-09-25 12:20',
    benchmark: '2026-09-25 14:10',
    smallData: '2026-09-25 15:00',
    scalability: '2026-09-25 15:45',
    evolution: '2026-09-25 16:30',
    noiseSweep: '2026-09-25 17:20',
    crossModality: '2026-09-25 18:05',
  }),
  ...datasetExperiments('wdbc', {
    benchmark: '2026-09-26 10:15',
    smallData: '2026-09-26 11:30',
    scalability: '2026-09-26 13:05',
    evolution: '2026-09-26 14:40',
    noiseSweep: '2026-09-26 16:20',
    svm: '2026-09-26 17:05',
    rf: '2026-09-26 17:40',
    logreg: '2026-09-27 09:41',
    vqcIdeal: '2026-09-27 11:02',
    xgboost: '2026-09-27 12:16',
    qsvm: '2026-09-27 13:48',
    vqcHardware: '2026-09-27 14:32',
  }),
].sort((a, b) => b.id.localeCompare(a.id))
