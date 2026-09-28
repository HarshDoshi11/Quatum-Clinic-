/**
 * Static domain facts (names, dataset sizes). Not results — every metric
 * comes through the API / mock layer. Imported by both UI and mocks.
 */
import type { BackendId, BackendInfo, DatasetId, ModelId, ModelInfo } from '../types/common'
import type { ModalityInfo } from '../types/crossModality'
import type { PatientIcon } from '../types/predict'

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

/** How Patient Mode presents one input: an icon, and the question in plain words ("Your age"). */
export interface PatientFeatureInfo {
  icon: PatientIcon
  question: string
}

/** Everything Patient Mode needs from a dataset. */
export interface PatientConfig {
  /** What the check is about, in patient copy ("heart disease"). */
  name: string
  /** One entry per input. check:mocks asserts every model input has one. */
  features: Record<string, PatientFeatureInfo>
  /** Short steps to read before starting (Part B shows them with the result). */
  guidance: string[]
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
  /** Probability where the risk band turns moderate, then high: [moderate, high]. The band depends only on the probability. */
  riskBandEdges: [number, number]
  /** Patient Mode: name, per-input icon and question, guidance. */
  patient: PatientConfig
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
    riskBandEdges: [0.3, 0.6],
    patient: {
      name: 'breast cancer',
      features: {
        radius_mean: { icon: 'circle-dot', question: 'Cell size (radius)' },
        texture_mean: { icon: 'grip', question: 'Texture variation' },
        perimeter_mean: { icon: 'circle-dashed', question: 'Cell outline length' },
        area_mean: { icon: 'square', question: 'Cell area' },
        smoothness_mean: { icon: 'spline', question: 'Edge smoothness' },
        compactness_mean: { icon: 'shrink', question: 'Compactness' },
        concavity_mean: { icon: 'orbit', question: 'Depth of indentations' },
        concave_points_mean: { icon: 'sparkles', question: 'Number of indentations' },
        symmetry_mean: { icon: 'scale', question: 'Symmetry' },
        fractal_dimension_mean: { icon: 'hexagon', question: 'Edge complexity' },
      },
      guidance: [
        'Have your biopsy or cytology report nearby: every answer comes from its measurements.',
        'Answer what the report shows. Choose “Not sure” for anything it doesn’t.',
        'Your answers stay on this device and are cleared when you close the page.',
      ],
    },
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
    riskBandEdges: [0.3, 0.6],
    patient: {
      name: 'heart disease',
      features: {
        age: { icon: 'cake', question: 'Your age' },
        sex: { icon: 'user', question: 'Your sex' },
        trestbps: { icon: 'gauge', question: 'Your blood pressure at rest' },
        cp: { icon: 'heart-crack', question: 'What kind of chest pain you have' },
        restecg: { icon: 'activity', question: 'Your resting heart tracing (ECG)' },
        oldpeak: { icon: 'trending-down', question: 'ECG change during exercise' },
        slope: { icon: 'trending-up', question: 'ECG slope at peak exercise' },
        thalach: { icon: 'heart-pulse', question: 'Your highest heart rate in the exercise test' },
        exang: { icon: 'footprints', question: 'Chest pain when you exercise' },
        thal: { icon: 'scan-line', question: 'Your heart scan result' },
        ca: { icon: 'waypoints', question: 'Narrowed vessels seen on your scan' },
        chol: { icon: 'droplet', question: 'Your cholesterol' },
        fbs: { icon: 'candy', question: 'High fasting blood sugar' },
      },
      guidance: [
        'Have your latest results nearby: blood pressure, cholesterol and any heart test reports.',
        'Answer what you know. Choose “Not sure” for anything you don’t.',
        'Your answers stay on this device and are cleared when you close the page.',
      ],
    },
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
