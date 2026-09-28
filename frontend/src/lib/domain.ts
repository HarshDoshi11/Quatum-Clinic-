/**
 * Static domain facts (names, dataset sizes). Not results — every metric
 * comes through the API / mock layer. Imported by both UI and mocks.
 */
import type { BackendId, BackendInfo, DatasetId, ModelId, ModelInfo } from '../types/common'
import type { ModalityInfo } from '../types/crossModality'

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
  /** Feature keys a patient can't change (e.g. age, sex); locked in what-if analysis. */
  lockedFeatures: string[]
  /** Caption above the what-if sliders on Explain; null for none. */
  explainCaption: string | null
  /**
   * Kinds of test the features come from. Cross-modality analysis runs when
   * there are two or more; with one, every feature belongs to it.
   */
  modalities: ModalityInfo[]
  /** How the patient report refers to the inputs: "Your" values, or "Your sample’s" when they measure a tissue sample. */
  reportSubject: string
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
    lockedFeatures: [],
    explainCaption: 'These are measurements of the tumor sample, not things a patient can change. Use this to see what the model pays attention to.',
    modalities: [{ id: 'cytology', label: 'Tumor cytology' }],
    reportSubject: 'Your sample’s',
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
    lockedFeatures: ['age', 'sex'],
    explainCaption: 'Age and sex are locked because they can’t be changed. Move the other sliders to see which factors shift the estimate. This is a simulation, not medical advice.',
    modalities: [
      { id: 'demographics', label: 'Demographics' },
      { id: 'symptoms', label: 'Symptoms' },
      { id: 'ecg', label: 'ECG' },
      { id: 'exercise', label: 'Exercise Test' },
      { id: 'labs', label: 'Blood Labs' },
    ],
    reportSubject: 'Your',
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
