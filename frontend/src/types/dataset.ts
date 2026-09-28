import type { PatientConfig } from '../lib/domain'
import type { DatasetId } from './common'
import type { ModalityInfo } from './crossModality'

export type ColumnType = 'numeric' | 'categorical' | 'binary'

export interface ColumnInfo {
  name: string
  label: string
  type: ColumnType
  isTarget: boolean
  missing: number
  unit: string | null
}

export interface ClassBalance {
  positiveLabel: string
  negativeLabel: string
  positive: number
  negative: number
}

export type DataRow = Record<string, number | string | null>

export type PreprocessStepId =
  | 'raw'
  | 'clean'
  | 'missing'
  | 'outliers'
  | 'normalize'
  | 'select'
  | 'pca'
  | 'ready'

export interface PreprocessStep {
  id: PreprocessStepId
  label: string
  detail: string
  rowsAfter: number
  featuresAfter: number
}

export interface PcaComponent {
  /** 1-based component index. */
  component: number
  /** Fraction of variance explained by this component. */
  explained: number
  cumulative: number
  /** Plain-words summary of what the component captures, e.g. "mostly tumor size". */
  label: string
  /** Original features that load most heavily on this component. */
  drivers: string[]
}

export interface DatasetSummary {
  id: DatasetId
  name: string
  code: string
  source: string
  samples: number
  features: number
  target: string
  missingValues: number
  classBalance: ClassBalance
  /** Feature keys a patient can't change; locked in what-if analysis (from the dataset config). */
  lockedFeatures: string[]
  /** Caption above the what-if sliders on Explain (from the dataset config); null for none. */
  explainCaption: string | null
  /** Kinds of test the features come from (from the dataset config); two or more enable cross-modality analysis. */
  modalities: ModalityInfo[]
  /** Condition in patient-facing copy (from the dataset config), e.g. "heart disease"; null for an uploaded file. */
  condition: string | null
  /**
   * Patient Mode (from the dataset config): what the check is about, reference ranges (or the note shown
   * instead), learn cards and suggested questions. Null for an uploaded file.
   */
  patient: Omit<PatientConfig, 'features' | 'guidance'> | null
}

export interface PreprocessingReport {
  steps: PreprocessStep[]
  missingBefore: number
  missingAfter: number
  outliersClipped: number
  selectedFeatures: string[]
  pcaDims: number
  pca: PcaComponent[]
  /** Experiment whose runs used this preprocessing (the dataset benchmark). */
  experimentId: string
  /**
   * The demo (sample) patient after PCA + scaling: one value in [0, 1] per qubit.
   * Higher values point toward |1⟩ and read as higher risk.
   */
  sampleEncoding: number[]
}

export interface DatasetDetail extends DatasetSummary {
  columns: ColumnInfo[]
  preview: DataRow[]
  preprocessing: PreprocessingReport
}

export interface UploadResponse {
  fileName: string
  /** Uploaded data is profiled but not yet trainable in the stub. */
  detail: Omit<DatasetDetail, 'id' | 'preprocessing'> & { id: string; preprocessing: PreprocessingReport | null }
}
