import type { BackendId, ConfigKey, DatasetId, ExperimentId, MeanStd, ModelId } from './common'
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
  /** A few words for one-line lists; `reason` is the full sentence (shown on hover). */
  short: string
}

/** Where the deployed model runs, so a page can say which backend its numbers come from. */
export interface DeployedSetting {
  backend: BackendId
  qubits: number
}

export interface PredictRequest {
  dataset: DatasetId
  input: PatientInput
  /** Decision threshold (fraction); defaults to the model's operating point. */
  threshold?: number
}

export type Decision = 'predict' | 'abstain'

export interface PredictResponse extends DeployedSetting {
  predictionId: string
  dataset: DatasetId
  model: ModelId
  experimentId: ExperimentId
  /** e.g. "QSVM 4q · noisy sim · same pipeline as training · WDBC". */
  evaluation: string
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
  /** ±1 std of the observed rate across the 5 seeds. */
  observedStd: number
  count: number
}

export interface ThresholdPoint {
  threshold: number
  sensitivity: number
  sensitivityStd: number
  specificity: number
  specificityStd: number
}

/** The model at its default threshold: exactly the results-store numbers shown on every page. */
export interface DefaultOperatingPoint {
  configKey: ConfigKey
  threshold: number
  auc: number
  sensitivity: MeanStd
  specificity: MeanStd
}

export interface TrustResponse extends DeployedSetting {
  dataset: DatasetId
  model: ModelId
  experimentId: ExperimentId
  /** e.g. "QSVM 4q · noisy sim · 5 seeds · held-out 30% · WDBC". */
  evaluation: string
  calibration: CalibrationBin[]
  /** Expected calibration error (fraction). */
  ece: number
  /** Count-weighted mean of (predicted − observed); positive = over-confident. */
  calibrationBias: number
  /** Computed reading of the calibration curve, judged against seed noise. */
  calibrationTakeaway: string
  /** 0.01 steps; the default-threshold point is the operating point. */
  thresholdCurve: ThresholdPoint[]
  operatingPoint: DefaultOperatingPoint
  /** Computed reading of the default operating point against the safety threshold. */
  thresholdTakeaway: string
  /** Sensitivity must stay at or above this to count as safe. */
  safeSensitivity: number
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

export interface ExplainResponse extends DeployedSetting {
  dataset: DatasetId
  model: ModelId
  experimentId: ExperimentId
  /** e.g. "QSVM 4Q · IDEAL SIM · WDBC". */
  evaluation: string
  /** Same abstain rule as Predict. */
  decision: Decision
  abstainReasons: string[]
  /** Probability for an average patient. */
  baseProbability: number
  /** Reported probability; null when the system abstains for this patient. */
  probability: number | null
  /**
   * The model's raw output, reported or not. Research Mode may show it behind an
   * explicit toggle, labelled "RAW ESTIMATE · NOT REPORTED"; never in Patient Mode.
   */
  rawProbability: number
  /** Sorted by |contribution|, descending. */
  contributions: FeatureContribution[]
  /** The patient after the training pipeline: what the circuit actually receives. */
  encoding: EncodedComponent[]
  /** Computed one-sentence reading of the contributions. */
  takeaway: string
}
