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
  /** Can't be changed in what-if analysis (e.g. age, sex). */
  immutable: boolean
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
  value: number | null
  /** Contribution to the log-odds of the positive class. */
  contribution: number
  direction: 'increases' | 'decreases'
  immutable: boolean
}

export interface ExplainResponse {
  dataset: DatasetId
  model: ModelId
  /** Probability for an average patient. */
  baseProbability: number
  probability: number
  /** Sorted by |contribution|, descending. */
  contributions: FeatureContribution[]
}
