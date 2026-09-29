import type { BackendId, ConfigKey, DatasetId, DataSource, ExperimentId, ModelFamily, ModelId, QuantumModelId } from './common'
import type { ExperimentMetrics } from './experiment'

export type MetricKey = keyof ExperimentMetrics

export interface ComparisonRow {
  model: ModelId
  family: ModelFamily
  configKey: ConfigKey
  backend: BackendId
  experimentId: ExperimentId
  metrics: ExperimentMetrics
  qubits: number | null
  circuitDepth: number | null
}

/** A quantum configuration placed on the performance-vs-resources scatter. */
export interface ResourcePoint {
  id: string
  configKey: ConfigKey
  model: QuantumModelId
  qubits: number
  circuitDepth: number
  auc: number
  aucStd: number
}

export interface Baseline {
  model: ModelId
  auc: number
}

export interface SeedPoint {
  model: ModelId
  seed: number
  auc: number
}

export interface CompareResponse {
  /** Where the numbers come from: the real pipeline (ml/) or the simulated results store. */
  source: DataSource
  dataset: DatasetId
  experimentId: ExperimentId
  seeds: number
  rows: ComparisonRow[]
  resources: ResourcePoint[]
  baselines: Baseline[]
  stability: SeedPoint[]
  /** Main claim, worded by whether the gap exceeds the combined seed std. */
  takeaway: string
  resourcesTakeaway: string
  stabilityTakeaway: string
  /** Evaluation setting, e.g. "5 SEEDS · HELD-OUT 30% · WDBC". */
  evaluation: string
}
