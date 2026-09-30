import type { PatientStep } from '../lib/domain'
import type { DatasetId, DataSource, ExperimentId, ISODateTime } from './common'
import type { Decision, PatientInput, RiskBand, TrustLevel, TrustSignalId } from './predict'

export interface ReportRequest {
  dataset: DatasetId
  input: PatientInput
}

export interface ReportInfluence {
  /** Feature key, so Patient Mode can show the config's icon and plain question. */
  feature: string
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
  /** Where the numbers come from: the real pipeline (ml/) or the simulated results store. */
  source: DataSource
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
    /** Natural-frequency reading of the calibrated probability ("About 7 in 10 …"); null when abstaining. */
    frequency: string | null
    /** round(probability × 10): the filled figures in Patient Mode; null when abstaining. */
    outOfTen: number | null
    /** Patient Mode headline by risk band, guiding rather than alarming; null when abstaining. */
    patientHeadline: string | null
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
  /** The same steps with their icons, from the dataset config's patient guidance for this outcome. */
  journey: PatientStep[]
  questions: string[]
  safetyNote: string
}
