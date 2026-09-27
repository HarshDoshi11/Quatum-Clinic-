import type { DatasetId, ExperimentId, ModelId, NoiseParams } from './common'

export type HardwareProfileId = 'ideal-sim' | 'fake-backend-1' | 'fake-backend-2' | 'custom'

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
}

/** All values are fractions (0–1). */
export interface OperatingPoint {
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
  sensitivityVsT2: { t2Us: number; sensitivity: number }[]
}
