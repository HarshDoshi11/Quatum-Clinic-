import type { DatasetId, ExperimentId, ModelId, NoiseParams } from './common'

export type HardwareProfileId = 'ideal-sim' | 'fake-backend-1' | 'fake-backend-2' | 'custom'

/** safe / unsafe only when the threshold is cleared by more than the seed std; else borderline. */
export type SafetyStatus = 'safe' | 'borderline' | 'unsafe'

export interface HardwareProfile {
  id: HardwareProfileId
  name: string
  description: string
  qubits: number
  noise: NoiseParams
}

export interface NoiseRunRequest {
  dataset: DatasetId
  profileId: HardwareProfileId
  noise: NoiseParams
  /** For custom settings: the preset they were edited from (used in the wording). */
  basedOn?: HardwareProfileId
}

/** All values are fractions (0–1). */
export interface OperatingPoint {
  /** Results-store key when this is a preset backend (null for custom settings). */
  configKey: string | null
  sensitivity: number
  specificity: number
  auc: number
}

export interface NoiseRunResponse {
  dataset: DatasetId
  experimentId: ExperimentId
  model: ModelId
  /** Noiseless reference (Ideal Sim). */
  reference: OperatingPoint
  result: OperatingPoint
  /** Seed/shot spread of the noisy sensitivity. */
  sensitivityStd: number
  /** Sensitivity threshold considered safe (fraction). */
  threshold: number
  safe: boolean
  status: SafetyStatus
  /** Headline, worded by the shared safety rule. */
  takeaway: string
  /** Where the T2 sweep crosses the threshold, worded by the same rule. */
  t2Takeaway: string
  /** Evaluation setting, e.g. "5 SEEDS · HELD-OUT 30% · QSVM 4Q · WDBC". */
  evaluation: string
  /** Sensitivity (and seed/shot std) as T2 varies, other noise held fixed. */
  sensitivityVsT2: { t2Us: number; sensitivity: number; std: number }[]
}
