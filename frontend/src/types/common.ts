/** Shared primitives used across every API response. */

export type DatasetId = 'wdbc' | 'heart'

export type ModelId = 'vqc' | 'qsvm' | 'logreg' | 'svm' | 'rf' | 'xgboost'
export type QuantumModelId = Extract<ModelId, 'vqc' | 'qsvm'>
export type ModelFamily = 'quantum' | 'classical'

export type Encoding = 'angle' | 'amplitude'
export type Entanglement = 'linear' | 'circular' | 'full'

/** Execution targets. `cpu` is used by classical models. */
export type BackendId = 'ideal-sim' | 'noisy-sim' | 'fake-backend-1' | 'fake-backend-2' | 'ibm-qpu' | 'cpu'

/** e.g. "EXP-2048" */
export type ExperimentId = string

/**
 * Identity of one evaluated configuration, e.g. "wdbc|vqc|4q|angle|d3|linear|ideal-sim".
 * The same key always carries the same result on every page (results store).
 */
export type ConfigKey = string

/** Variational ansatz family; decides the trainable-parameter formula. */
export type Ansatz = 'strongly-entangling' | 'real-amplitudes' | 'zz-kernel'

/** ISO-8601 timestamp with offset, e.g. "2026-09-27T14:32:00+05:30". */
export type ISODateTime = string

/** A metric aggregated over seeds. Fractions (0–1) unless the field name says otherwise. */
export interface MeanStd {
  mean: number
  std: number
}

export interface ModelInfo {
  id: ModelId
  /** Short display name, e.g. "QSVM". */
  name: string
  /** Full name, e.g. "Quantum Support Vector Machine". */
  longName: string
  family: ModelFamily
}

export interface BackendInfo {
  id: BackendId
  name: string
}

/** Hardware noise parameters. Errors are percentages (1.2 = 1.2%); null = not modelled (ideal). */
export interface NoiseParams {
  t1Us: number | null
  t2Us: number | null
  gateError1q: number
  gateError2q: number
  readoutError: number
  shots: number | null
}
