import type { DatasetId, ExperimentId, ModelId } from './common'
import type { ModalityId } from './crossModality'

export type FeatureKind = 'continuous' | 'integer' | 'binary' | 'categorical'

export interface FeatureOption {
  value: number
  label: string
}

export interface FeatureSpec {
  key: string
  label: string
  /** Plain-language label for Patient Mode. */
  plainLabel: string
  unit: string | null
  kind: FeatureKind
  options: FeatureOption[] | null
  /** Valid range seen in training data; values outside are out-of-distribution. */
  min: number
  max: number
  step: number
  /** Can't be changed in what-if analysis; derived from the dataset config's lockedFeatures. */
  locked: boolean
  /** Step group for the patient assessment form. */
  group: string
  modality: ModalityId | null
}

/** Feature key → value; null = missing. */
export type PatientInput = Record<string, number | null>

export interface FeatureSchema {
  dataset: DatasetId
  features: FeatureSpec[]
  samplePatient: PatientInput
  unusualPatient: PatientInput
}

export type RiskBand = 'low' | 'moderate' | 'high'

/** filled / half / empty square in the UI. */
export type TrustLevel = 'strong' | 'partial' | 'weak'

export type TrustSignalId =
  | 'stability'
  | 'data-quality'
  | 'distribution-shift'
  | 'calibration'
  | 'input-sensitivity'
  | 'hardware-sensitivity'

export interface TrustSignal {
  id: TrustSignalId
  label: string
  level: TrustLevel
  reason: string
}

export interface PredictRequest {
  dataset: DatasetId
  input: PatientInput
  /** Decision threshold (fraction); defaults to the model's operating point. */
  threshold?: number
}

export type Decision = 'predict' | 'abstain'

export interface PredictResponse {
  predictionId: string
  dataset: DatasetId
  model: ModelId
  experimentId: ExperimentId
  decision: Decision
  /** Null when abstaining. */
  probability: number | null
  /** Spread across seeds, [low, high]. */
  interval: [number, number] | null
  riskBand: RiskBand | null
  threshold: number
  /** True when probability ≥ threshold. */
  flagged: boolean | null
  abstainReasons: string[]
  trust: TrustSignal[]
}

// ─── Model-level trust ──────────────────────────────────────

export interface CalibrationBin {
  predicted: number
  observed: number
  count: number
}

export interface ThresholdPoint {
  threshold: number
  sensitivity: number
  specificity: number
}

export interface TrustResponse {
  dataset: DatasetId
  model: ModelId
  experimentId: ExperimentId
  calibration: CalibrationBin[]
  /** Expected calibration error (fraction). */
  ece: number
  thresholdCurve: ThresholdPoint[]
  defaultThreshold: number
  testPatients: number
  abstained: number
  abstainRate: number
  highConfidenceMisses: number
}

// ─── Explanation ────────────────────────────────────────────

export interface ExplainRequest {
  dataset: DatasetId
  input: PatientInput
}

export interface FeatureContribution {
  feature: string
  label: string
  unit: string | null
  /** Value as entered (null = missing). */
  value: number | null
  /** Value the model used after preprocessing (missing → training mean, clipped to the training range). */
  used: number
  adjustment: 'imputed' | 'clipped' | null
  /**
   * Contribution to the log-odds of the positive class. The model sees only the
   * PCA components; each component's effect is attributed back to the original
   * features through the loadings, so contributions sum exactly to
   * logit(probability) − logit(baseProbability).
   */
  contribution: number
  direction: 'increases' | 'decreases'
  locked: boolean
}

export interface EncodedComponent {
  /** 1-based PCA component = qubit index + 1. */
  component: number
  label: string
  /** Angle-encoding input in [0, 1]; higher reads as higher risk. */
  value: number
}

export interface ExplainResponse {
  dataset: DatasetId
  model: ModelId
  experimentId: ExperimentId
  /** e.g. "QSVM 4Q · IDEAL SIM · WDBC". */
  evaluation: string
  /** Probability for an average patient. */
  baseProbability: number
  probability: number
  /** Sorted by |contribution|, descending. */
  contributions: FeatureContribution[]
  /** The patient after the training pipeline: what the circuit actually receives. */
  encoding: EncodedComponent[]
  /** Computed one-sentence reading of the contributions. */
  takeaway: string
}
