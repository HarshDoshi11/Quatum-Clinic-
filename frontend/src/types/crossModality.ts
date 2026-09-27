import type { DatasetId, ExperimentId, MeanStd, ModelId } from './common'

export type ModalityId = 'demographics' | 'symptoms' | 'ecg' | 'exercise' | 'labs'

export interface Modality {
  id: ModalityId
  label: string
  features: string[]
  auc: MeanStd
}

export interface CrossModalityAvailable {
  available: true
  dataset: DatasetId
  experimentId: ExperimentId
  model: ModelId
  modalities: Modality[]
  combined: MeanStd
  bestSingle: ModalityId
  /** Relative gain of combined over best single, in percent (6.2 = +6.2%). */
  gainPct: number
  takeaway: string
}

export interface CrossModalityUnavailable {
  available: false
  dataset: DatasetId
  reason: string
  /** Dataset that supports the analysis. */
  supportedDataset: DatasetId
}

export type CrossModalityResponse = CrossModalityAvailable | CrossModalityUnavailable
