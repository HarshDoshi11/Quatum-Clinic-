/** Experiment registry: every experiment ID shown anywhere resolves here. */
import { DATASETS, MODELS } from '../../lib/domain'
import type { BackendId, DatasetId, Experiment, ExperimentKind, ModelId, NoiseParams } from '../../types'
import { NOISE_PROFILES, SEEDS } from './canon'
import { EXPERIMENT_IDS } from './ids'
import { referenceConfig, referenceResult, result, type ModelConfig } from './results'

/** Features kept after selection (see preprocessing). */
export const SELECTED_FEATURES: Record<DatasetId, number> = { wdbc: 16, heart: 13 }

/** "2026-09-27 14:32" (IST) → ISO-8601. */
const at = (when: string): string => `${when.replace(' ', 'T')}:00+05:30`

export const NOISE_FOR_BACKEND: Partial<Record<BackendId, NoiseParams>> = {
  'ideal-sim': NOISE_PROFILES.ideal,
  'noisy-sim': NOISE_PROFILES.noisySim,
  'fake-backend-1': NOISE_PROFILES.fakeBackend1,
  'fake-backend-2': NOISE_PROFILES.fakeBackend2,
}

/** A single-configuration experiment record; all numbers come from the results store. */
export function runRecord(id: string, dataset: DatasetId, config: ModelConfig, timestamp: string, notes: string, title?: string): Experiment {
  const r = result(dataset, config)
  const c = r.config
  const info = MODELS[c.model]
  return {
    id,
    kind: 'run',
    configKey: r.key,
    title: title ?? (c.qubits ? `${info.name} · ${c.qubits}q` : info.name),
    dataset,
    model: c.model,
    family: info.family,
    backend: c.backend,
    qubits: c.qubits,
    auc: r.auc.mean,
    timestamp,
    status: 'complete',
    config: {
      dataset,
      models: [c.model],
      features: SELECTED_FEATURES[dataset],
      pcaDims: c.qubits,
      encoding: c.encoding,
      qubits: c.qubits,
      circuitDepth: c.circuitDepth,
      entanglement: c.entanglement,
      backend: c.backend,
      noise: c.qubits ? (NOISE_FOR_BACKEND[c.backend] ?? null) : null,
      seed: 42,
      seeds: SEEDS,
    },
    metrics: r.metrics,
    notes,
  }
}

interface RunSpec {
  id: string
  dataset: DatasetId
  model: ModelId
  timestamp: string
  /** Overrides on the model's benchmark configuration. */
  config?: Partial<ModelConfig>
  notes: string
}

function run(spec: RunSpec): Experiment {
  return runRecord(spec.id, spec.dataset, { ...referenceConfig(spec.dataset, spec.model), ...spec.config }, spec.timestamp, spec.notes)
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
    configKey: null,
    title: spec.title,
    dataset: spec.dataset,
    model: spec.model,
    family,
    backend: spec.backend,
    qubits: spec.qubits,
    auc: spec.model ? referenceResult(spec.dataset, spec.model).auc.mean : null,
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
    metrics: spec.model ? referenceResult(spec.dataset, spec.model).metrics : null,
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
    run({ id: ids.svmRun, dataset, model: 'svm', timestamp: at(schedule.svm), notes: 'RBF kernel, C and γ tuned by 5-fold CV.' }),
    run({ id: ids.rfRun, dataset, model: 'rf', timestamp: at(schedule.rf), notes: '500 trees, balanced class weights.' }),
    run({ id: ids.logregRun, dataset, model: 'logreg', timestamp: at(schedule.logreg), notes: 'L2-regularised baseline.' }),
    run({ id: ids.vqcIdealRun, dataset, model: 'vqc', timestamp: at(schedule.vqcIdeal), notes: 'Best VQC configuration from the circuit search.' }),
    run({ id: ids.xgboostRun, dataset, model: 'xgboost', timestamp: at(schedule.xgboost), notes: 'Gradient-boosted trees, 300 rounds, early stopping.' }),
    run({ id: ids.qsvmRun, dataset, model: 'qsvm', timestamp: at(schedule.qsvm), notes: 'Two-repetition ZZ feature-map kernel, 4 qubits.' }),
    run({
      id: ids.vqcHardwareRun,
      dataset,
      model: 'vqc',
      config: { qubits: 4, backend: 'fake-backend-1' },
      timestamp: at(schedule.vqcHardware),
      notes: 'Hardware-noise check on FakeBackend-1 calibration data.',
    }),
    study({ id: ids.benchmark, dataset, kind: 'benchmark', title: `Benchmark · ${name} · 6 models`, models: ALL_MODELS, model: null, backend: 'noisy-sim', qubits: 4, circuitDepth: 2, timestamp: at(schedule.benchmark), notes: 'Quantum vs classical, 5 seeds, identical splits.' }),
    study({ id: ids.smallData, dataset, kind: 'sweep', title: 'Small-data sweep', models: ['qsvm', 'vqc', 'svm', 'xgboost', 'logreg'], model: null, backend: 'noisy-sim', qubits: 4, circuitDepth: 2, timestamp: at(schedule.smallData), notes: 'Training sizes 25 → all, 5 seeds each.' }),
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

/**
 * Circuit-search designs have their own records ("EXP-2040.C16"), resolved on
 * demand so they open in the drawer without crowding experiment lists.
 */
export function circuitSearchChild(id: string, designs: (dataset: DatasetId) => { id: string; experimentId: string; qubits: number; circuitDepth: number; encoding: 'angle' | 'amplitude'; entanglement: 'linear' | 'circular' | 'full' }[]): Experiment | null {
  const m = /^(EXP-\d+)\.(C\d+)$/.exec(id)
  if (!m) return null
  for (const dataset of Object.keys(EXPERIMENT_IDS) as DatasetId[]) {
    if (EXPERIMENT_IDS[dataset].evolution !== m[1]) continue
    const d = designs(dataset).find((x) => x.id === m[2])
    const parent = EXPERIMENTS.find((e) => e.id === m[1])
    if (!d || !parent) return null
    return runRecord(
      id,
      dataset,
      { model: 'vqc', qubits: d.qubits, encoding: d.encoding, circuitDepth: d.circuitDepth, entanglement: d.entanglement, backend: 'ideal-sim' },
      parent.timestamp,
      `Design ${d.id} of the circuit search ${m[1]}.`,
      `VQC · ${d.qubits}q · ${d.id}`,
    )
  }
  return null
}
