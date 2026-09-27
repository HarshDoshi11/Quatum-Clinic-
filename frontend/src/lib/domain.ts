/**
 * Static domain facts (names, dataset sizes). Not results — every metric
 * comes through the API / mock layer. Imported by both UI and mocks.
 */
import type { BackendId, BackendInfo, DatasetId, ModelId, ModelInfo } from '../types/common'

export const MODELS: Record<ModelId, ModelInfo> = {
  vqc: { id: 'vqc', name: 'VQC', longName: 'Variational Quantum Classifier', family: 'quantum' },
  qsvm: { id: 'qsvm', name: 'QSVM', longName: 'Quantum Support Vector Machine', family: 'quantum' },
  logreg: { id: 'logreg', name: 'LogReg', longName: 'Logistic Regression', family: 'classical' },
  svm: { id: 'svm', name: 'SVM', longName: 'Support Vector Machine (RBF)', family: 'classical' },
  rf: { id: 'rf', name: 'Random Forest', longName: 'Random Forest', family: 'classical' },
  xgboost: { id: 'xgboost', name: 'XGBoost', longName: 'Gradient-Boosted Trees', family: 'classical' },
}

export const MODEL_ORDER: readonly ModelId[] = ['vqc', 'qsvm', 'logreg', 'svm', 'rf', 'xgboost']

export const BACKENDS: Record<BackendId, BackendInfo> = {
  'ideal-sim': { id: 'ideal-sim', name: 'Ideal Sim' },
  'noisy-sim': { id: 'noisy-sim', name: 'Noisy Sim' },
  'fake-backend-1': { id: 'fake-backend-1', name: 'FakeBackend-1' },
  'fake-backend-2': { id: 'fake-backend-2', name: 'FakeBackend-2' },
  'ibm-qpu': { id: 'ibm-qpu', name: 'IBM QPU' },
  cpu: { id: 'cpu', name: 'CPU' },
}

export interface DatasetMeta {
  id: DatasetId
  name: string
  code: string
  /** Condition name used in patient-facing copy. */
  condition: string
  samples: number
  features: number
  positive: number
  negative: number
  positiveLabel: string
  negativeLabel: string
  source: string
}

export const DATASETS: Record<DatasetId, DatasetMeta> = {
  wdbc: {
    id: 'wdbc',
    name: 'Breast Cancer',
    code: 'WDBC',
    condition: 'breast cancer',
    samples: 569,
    features: 30,
    positive: 212,
    negative: 357,
    positiveLabel: 'Malignant',
    negativeLabel: 'Benign',
    source: 'Wisconsin Diagnostic Breast Cancer, UCI ML Repository',
  },
  heart: {
    id: 'heart',
    name: 'Heart Disease',
    code: 'UCI',
    condition: 'heart disease',
    samples: 303,
    features: 13,
    positive: 139,
    negative: 164,
    positiveLabel: 'Disease',
    negativeLabel: 'No disease',
    source: 'Cleveland Heart Disease, UCI ML Repository',
  },
}

export const DATASET_IDS: readonly DatasetId[] = ['wdbc', 'heart']

/** 70/30 stratified split used by every experiment. */
export const TEST_FRACTION = 0.3

export function testSize(dataset: DatasetId): number {
  return Math.round(DATASETS[dataset].samples * TEST_FRACTION)
}

export function trainSize(dataset: DatasetId): number {
  return DATASETS[dataset].samples - testSize(dataset)
}
