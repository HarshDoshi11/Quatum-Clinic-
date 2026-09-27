import type { DatasetId } from './common'

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
}

export interface PreprocessingReport {
  steps: PreprocessStep[]
  missingBefore: number
  missingAfter: number
  outliersClipped: number
  selectedFeatures: string[]
  pcaDims: number
  pca: PcaComponent[]
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
