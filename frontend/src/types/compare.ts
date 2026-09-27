import type { DatasetId, ExperimentId, ModelFamily, ModelId, QuantumModelId } from './common'
import type { ExperimentMetrics } from './experiment'

export type MetricKey = keyof ExperimentMetrics

export interface ComparisonRow {
  model: ModelId
  family: ModelFamily
  experimentId: ExperimentId
  metrics: ExperimentMetrics
  qubits: number | null
  circuitDepth: number | null
}

/** A quantum configuration placed on the performance-vs-resources scatter. */
export interface ResourcePoint {
  id: string
  model: QuantumModelId
  qubits: number
  circuitDepth: number
  auc: number
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
  dataset: DatasetId
  experimentId: ExperimentId
  seeds: number
  rows: ComparisonRow[]
  resources: ResourcePoint[]
  baselines: Baseline[]
  stability: SeedPoint[]
  takeaway: string
}
