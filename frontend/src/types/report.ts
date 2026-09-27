import type { DatasetId, ExperimentId, ISODateTime } from './common'
import type { Decision, PatientInput, RiskBand, TrustLevel } from './predict'

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
    headline: string
  }
  meaning: string
  reliability: {
    level: TrustLevel
    summary: string
    points: string[]
  }
  influences: ReportInfluence[]
  nextSteps: string[]
  questions: string[]
  safetyNote: string
}
