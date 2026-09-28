import type { DatasetId, ExperimentId, ISODateTime } from './common'
import type { Decision, PatientInput, RiskBand, TrustLevel, TrustSignalId } from './predict'

export interface ReportRequest {
  dataset: DatasetId
  input: PatientInput
}

export interface ReportInfluence {
  label: string
  direction: 'increases' | 'decreases'
  /** One plain-language sentence. */
  plain: string
}

/** One trust check, in plain words (label) with the technical reason (detail). */
export interface ReliabilityPoint {
  id: TrustSignalId
  level: TrustLevel
  label: string
  detail: string
}

export interface PatientReport {
  reportId: string
  dataset: DatasetId
  condition: string
  generatedAt: ISODateTime
  experimentId: ExperimentId
  result: {
    decision: Decision
    riskBand: RiskBand | null
    probability: number | null
    /** "Higher likelihood" / "No reliable result". */
    headline: string
    /** Natural-frequency reading of the calibrated probability; null when abstaining. */
    frequency: string | null
    /** Why there is no result, in plain language; empty unless abstaining. */
    reasons: string[]
  }
  meaning: string
  reliability: {
    level: TrustLevel
    /** Computed from the checks: how many passed and which were less certain. */
    summary: string
    points: ReliabilityPoint[]
  }
  /** Strongest influences; empty when the model abstains (there is no result to explain). */
  influences: ReportInfluence[]
  nextSteps: string[]
  questions: string[]
  safetyNote: string
}
