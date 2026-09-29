import type { BackendId, ConfigKey, DatasetId, DataSource, ExperimentId, MeanStd, ModelId } from './common'

export type ModalityId = 'demographics' | 'symptoms' | 'ecg' | 'exercise' | 'labs' | 'cytology'

/** A kind of test, declared on the dataset config. */
export interface ModalityInfo {
  id: ModalityId
  label: string
}

/** One evaluated feature subset (a single modality, or all of them). */
export interface ModalityResult {
  configKey: ConfigKey
  label: string
  /** Feature keys the model saw. */
  features: string[]
  auc: MeanStd
}

export interface Modality extends ModalityResult {
  id: ModalityId
}

/**
 * How the combined model compares with the best single modality, judged
 * against the combined seed std √(σ₁² + σ₂²).
 */
export type CombinedVerdict = 'gain' | 'within-noise' | 'loss'

export interface CrossModalityAvailable {
  /** Where the numbers come from: the real pipeline (ml/) or the simulated results store. */
  source: DataSource
  available: true
  dataset: DatasetId
  experimentId: ExperimentId
  model: ModelId
  backend: BackendId
  qubits: number
  /** e.g. "QSVM 4Q · NOISY SIM · 5 SEEDS · HELD-OUT 30% · UCI". */
  evaluation: string
  modalities: Modality[]
  /** All modalities together: the full-feature benchmark model. */
  combined: ModalityResult
  bestSingle: ModalityId
  /** Relative gain of combined over best single, in percent (6.2 = +6.2%). */
  gainPct: number
  /** Combined − best single AUC, and the combined seed std it is judged against. */
  difference: number
  noise: number
  verdict: CombinedVerdict
  takeaway: string
}

export interface CrossModalityUnavailable {
  /** Where the numbers come from: the real pipeline (ml/) or the simulated results store. */
  source: DataSource
  available: false
  dataset: DatasetId
  /** e.g. "Cross-modality analysis uses the Heart Disease dataset." */
  reason: string
  /** Why, from the dataset config: which single kind of test this dataset has. */
  detail: string
  /** Datasets whose config declares two or more modalities. */
  supportedDatasets: DatasetId[]
}

export type CrossModalityResponse = CrossModalityAvailable | CrossModalityUnavailable
