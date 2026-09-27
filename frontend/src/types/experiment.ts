import type {
  BackendId,
  DatasetId,
  Encoding,
  Entanglement,
  ExperimentId,
  ISODateTime,
  MeanStd,
  ModelFamily,
  ModelId,
  NoiseParams,
} from './common'

export type ExperimentKind = 'run' | 'benchmark' | 'sweep'
export type ExperimentStatus = 'complete' | 'running' | 'failed'

export interface ExperimentConfig {
  dataset: DatasetId
  models: ModelId[]
  /** Input features before PCA. */
  features: number
  pcaDims: number | null
  encoding: Encoding | null
  qubits: number | null
  circuitDepth: number | null
  entanglement: Entanglement | null
  backend: BackendId
  noise: NoiseParams | null
  seed: number
  seeds: number
}

export interface ExperimentMetrics {
  accuracy: MeanStd
  sensitivity: MeanStd
  specificity: MeanStd
  auc: MeanStd
  trainTimeS: MeanStd
  inferenceMs: MeanStd
}

/** Row shape for experiment lists. */
export interface ExperimentSummary {
  id: ExperimentId
  kind: ExperimentKind
  /** Results-store key for single-configuration runs; null for studies spanning many configs. */
  configKey: string | null
  title: string
  dataset: DatasetId
  /** Null for benchmarks/sweeps spanning several models. */
  model: ModelId | null
  family: ModelFamily | null
  backend: BackendId
  qubits: number | null
  auc: number | null
  timestamp: ISODateTime
  status: ExperimentStatus
}

/** Full record shown in the experiment drawer. */
export interface Experiment extends ExperimentSummary {
  config: ExperimentConfig
  metrics: ExperimentMetrics | null
  notes: string
}

export interface ExperimentListParams {
  dataset?: DatasetId
  limit?: number
}

// ─── Training ───────────────────────────────────────────────

export type QubitCount = 4 | 6 | 8
export type CircuitDepth = 1 | 2 | 3 | 4
export type SeedCount = 1 | 2 | 3 | 4 | 5

export interface TrainRequest {
  dataset: DatasetId
  models: ModelId[]
  qubits: QubitCount
  encoding: Encoding
  circuitDepth: CircuitDepth
  seeds: SeedCount
}

export interface LossPoint {
  epoch: number
  loss: number
  valLoss: number
}

export interface TrainModelResult {
  model: ModelId
  family: ModelFamily
  configKey: string
  backend: BackendId
  qubits: number | null
  circuitDepth: number | null
  encoding: Encoding | null
  auc: MeanStd
}

export interface TrainResponse {
  jobId: string
  experimentId: ExperimentId
  epochs: number
  /** Loss curve of the variational model (VQC); empty if no VQC was trained. */
  lossCurve: LossPoint[]
  results: TrainModelResult[]
  completedAt: ISODateTime
}
