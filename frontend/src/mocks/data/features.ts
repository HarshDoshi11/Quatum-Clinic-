/**
 * Patient-level feature definitions for each dataset, plus the population
 * statistics and weights of the mock scoring model.
 * Means / SDs / ranges are the real dataset statistics.
 */
import { DATASETS } from '../../lib/domain'
import type { DatasetId, FeatureSchema, FeatureSpec, PatientInput } from '../../types'

export interface ModelFeature extends FeatureSpec {
  mean: number
  sd: number
  /** Log-odds per standard deviation. */
  weight: number
}

type Def = Omit<ModelFeature, 'options' | 'modality' | 'locked' | 'group' | 'plainLabel' | 'icon' | 'plainName' | 'question' | 'helper'> &
  Partial<Pick<ModelFeature, 'options' | 'modality' | 'group' | 'plainLabel'>>

/** Locked, icon and question are never set per feature: they come from the dataset config. */
const feature = (d: Def): Omit<ModelFeature, 'locked' | 'icon' | 'plainName' | 'question' | 'helper'> => ({
  options: null,
  modality: null,
  group: 'Measurements',
  plainLabel: d.label,
  ...d,
})

// ─── WDBC: the ten "mean" cell-nucleus measurements ─────────

const WDBC_FEATURES: Omit<ModelFeature, 'locked' | 'icon' | 'plainName' | 'question' | 'helper'>[] = [
  feature({ key: 'radius_mean', label: 'Radius', plainLabel: 'Cell size (radius)', unit: 'µm', kind: 'continuous', min: 6.98, max: 28.11, step: 0.01, mean: 14.13, sd: 3.52, weight: 0.9, group: 'Size' }),
  feature({ key: 'texture_mean', label: 'Texture', plainLabel: 'Texture variation', unit: null, kind: 'continuous', min: 9.71, max: 39.28, step: 0.01, mean: 19.29, sd: 4.3, weight: 0.45, group: 'Shape & texture' }),
  feature({ key: 'perimeter_mean', label: 'Perimeter', plainLabel: 'Cell outline length', unit: 'µm', kind: 'continuous', min: 43.79, max: 188.5, step: 0.1, mean: 91.97, sd: 24.3, weight: 0.8, group: 'Size' }),
  feature({ key: 'area_mean', label: 'Area', plainLabel: 'Cell area', unit: 'µm²', kind: 'continuous', min: 143.5, max: 2501, step: 1, mean: 654.9, sd: 351.9, weight: 0.7, group: 'Size' }),
  feature({ key: 'smoothness_mean', label: 'Smoothness', plainLabel: 'Edge smoothness', unit: null, kind: 'continuous', min: 0.0526, max: 0.1634, step: 0.0001, mean: 0.0964, sd: 0.0141, weight: 0.3, group: 'Shape & texture' }),
  feature({ key: 'compactness_mean', label: 'Compactness', plainLabel: 'Compactness', unit: null, kind: 'continuous', min: 0.0194, max: 0.3454, step: 0.0001, mean: 0.1043, sd: 0.0528, weight: 0.25, group: 'Shape & texture' }),
  feature({ key: 'concavity_mean', label: 'Concavity', plainLabel: 'Depth of indentations', unit: null, kind: 'continuous', min: 0, max: 0.4268, step: 0.0001, mean: 0.0888, sd: 0.0797, weight: 0.6, group: 'Shape & texture' }),
  feature({ key: 'concave_points_mean', label: 'Concave points', plainLabel: 'Number of indentations', unit: null, kind: 'continuous', min: 0, max: 0.2012, step: 0.0001, mean: 0.0489, sd: 0.0388, weight: 1.1, group: 'Shape & texture' }),
  feature({ key: 'symmetry_mean', label: 'Symmetry', plainLabel: 'Symmetry', unit: null, kind: 'continuous', min: 0.106, max: 0.304, step: 0.0001, mean: 0.1812, sd: 0.0274, weight: 0.15, group: 'Shape & texture' }),
  feature({ key: 'fractal_dimension_mean', label: 'Fractal dimension', plainLabel: 'Edge complexity', unit: null, kind: 'continuous', min: 0.05, max: 0.0974, step: 0.0001, mean: 0.0628, sd: 0.0071, weight: -0.1, group: 'Shape & texture' }),
]

// ─── Heart: the 13 Cleveland attributes ─────────────────────

const HEART_FEATURES: Omit<ModelFeature, 'locked' | 'icon' | 'plainName' | 'question' | 'helper'>[] = [
  feature({ key: 'age', label: 'Age', plainLabel: 'Age', unit: 'years', kind: 'integer', min: 29, max: 77, step: 1, mean: 54.4, sd: 9.0, weight: 0.25, group: 'About you', modality: 'demographics' }),
  feature({ key: 'sex', label: 'Sex', plainLabel: 'Sex', unit: null, kind: 'binary', options: [{ value: 0, label: 'Female' }, { value: 1, label: 'Male' }], min: 0, max: 1, step: 1, mean: 0.68, sd: 0.47, weight: 0.35, group: 'About you', modality: 'demographics' }),
  feature({ key: 'trestbps', label: 'Resting BP', plainLabel: 'Resting blood pressure', unit: 'mmHg', kind: 'integer', min: 94, max: 200, step: 1, mean: 131.7, sd: 17.6, weight: 0.2, group: 'About you', modality: 'demographics' }),
  feature({ key: 'cp', label: 'Chest pain type', plainLabel: 'Type of chest pain', unit: null, kind: 'categorical', options: [{ value: 0, label: 'Typical angina' }, { value: 1, label: 'Atypical angina' }, { value: 2, label: 'Non-anginal' }, { value: 3, label: 'Asymptomatic' }], min: 0, max: 3, step: 1, mean: 2.16, sd: 0.96, weight: 0.5, group: 'Symptoms', modality: 'symptoms' }),
  feature({ key: 'restecg', label: 'Resting ECG', plainLabel: 'Resting heart tracing (ECG)', unit: null, kind: 'categorical', options: [{ value: 0, label: 'Normal' }, { value: 1, label: 'ST-T abnormality' }, { value: 2, label: 'LV hypertrophy' }], min: 0, max: 2, step: 1, mean: 0.99, sd: 0.99, weight: 0.15, group: 'Heart tests', modality: 'ecg' }),
  feature({ key: 'oldpeak', label: 'ST depression', plainLabel: 'ECG change during exercise', unit: 'mm', kind: 'continuous', min: 0, max: 6.2, step: 0.1, mean: 1.04, sd: 1.16, weight: 0.55, group: 'Heart tests', modality: 'ecg' }),
  feature({ key: 'slope', label: 'ST slope', plainLabel: 'ECG slope at peak exercise', unit: null, kind: 'categorical', options: [{ value: 0, label: 'Upsloping' }, { value: 1, label: 'Flat' }, { value: 2, label: 'Downsloping' }], min: 0, max: 2, step: 1, mean: 0.6, sd: 0.62, weight: 0.35, group: 'Heart tests', modality: 'ecg' }),
  feature({ key: 'thalach', label: 'Max heart rate', plainLabel: 'Highest heart rate in exercise test', unit: 'bpm', kind: 'integer', min: 71, max: 202, step: 1, mean: 149.6, sd: 22.9, weight: -0.55, group: 'Heart tests', modality: 'exercise' }),
  feature({ key: 'exang', label: 'Exercise angina', plainLabel: 'Chest pain during exercise', unit: null, kind: 'binary', options: [{ value: 0, label: 'No' }, { value: 1, label: 'Yes' }], min: 0, max: 1, step: 1, mean: 0.33, sd: 0.47, weight: 0.45, group: 'Symptoms', modality: 'exercise' }),
  feature({ key: 'thal', label: 'Thallium scan', plainLabel: 'Heart scan result', unit: null, kind: 'categorical', options: [{ value: 0, label: 'Normal' }, { value: 1, label: 'Fixed defect' }, { value: 2, label: 'Reversible defect' }], min: 0, max: 2, step: 1, mean: 0.83, sd: 0.95, weight: 0.6, group: 'Heart tests', modality: 'exercise' }),
  feature({ key: 'ca', label: 'Major vessels', plainLabel: 'Narrowed vessels seen on scan', unit: 'count', kind: 'integer', min: 0, max: 3, step: 1, mean: 0.67, sd: 0.94, weight: 0.75, group: 'Heart tests', modality: 'exercise' }),
  feature({ key: 'chol', label: 'Cholesterol', plainLabel: 'Cholesterol', unit: 'mg/dL', kind: 'integer', min: 126, max: 564, step: 1, mean: 246.7, sd: 51.8, weight: 0.15, group: 'Blood tests', modality: 'labs' }),
  feature({ key: 'fbs', label: 'Fasting sugar > 120', plainLabel: 'High fasting blood sugar', unit: null, kind: 'binary', options: [{ value: 0, label: 'No' }, { value: 1, label: 'Yes' }], min: 0, max: 1, step: 1, mean: 0.15, sd: 0.36, weight: 0.05, group: 'Blood tests', modality: 'labs' }),
]

/** Locks come from the config; with a single declared modality, every feature belongs to it. */
const withConfig = (dataset: DatasetId, defs: Omit<ModelFeature, 'locked' | 'icon' | 'plainName' | 'question' | 'helper'>[]): ModelFeature[] => {
  const { lockedFeatures, modalities, patient } = DATASETS[dataset]
  const only = modalities.length === 1 ? modalities[0].id : null
  return defs.map((f) => ({
    ...f,
    modality: f.modality ?? only,
    locked: lockedFeatures.includes(f.key),
    // A missing entry falls back to the plain label (check:mocks asserts the config covers every input).
    icon: patient.features[f.key]?.icon ?? 'circle-dot',
    plainName: patient.features[f.key]?.plainName ?? f.plainLabel,
    question: patient.features[f.key]?.question ?? f.plainLabel,
    helper: patient.features[f.key]?.helper ?? '',
  }))
}

export const MODEL_FEATURES: Record<DatasetId, ModelFeature[]> = { wdbc: withConfig('wdbc', WDBC_FEATURES), heart: withConfig('heart', HEART_FEATURES) }

/** Demo patient; the scoring model is calibrated so this patient scores SAMPLE_PROBABILITY. */
export const SAMPLE_PATIENTS: Record<DatasetId, PatientInput> = {
  wdbc: {
    radius_mean: 17.2,
    texture_mean: 21.4,
    perimeter_mean: 113.0,
    area_mean: 920,
    smoothness_mean: 0.101,
    compactness_mean: 0.128,
    concavity_mean: 0.142,
    concave_points_mean: 0.083,
    symmetry_mean: 0.19,
    fractal_dimension_mean: 0.061,
  },
  heart: {
    age: 58,
    sex: 1,
    trestbps: 140,
    cp: 3,
    restecg: 1,
    oldpeak: 1.8,
    slope: 1,
    thalach: 128,
    exang: 1,
    thal: 2,
    ca: 1,
    chol: 268,
    fbs: 0,
  },
}

export const SAMPLE_PROBABILITY = 0.82

/** Out-of-distribution demo patient: values beyond the training range and a missing field → abstain. */
export const UNUSUAL_PATIENTS: Record<DatasetId, PatientInput> = {
  wdbc: {
    ...SAMPLE_PATIENTS.wdbc,
    area_mean: 4250,
    smoothness_mean: 0.21,
    texture_mean: null,
  },
  heart: {
    ...SAMPLE_PATIENTS.heart,
    chol: 610,
    trestbps: 215,
    thalach: null,
  },
}

/** Public schema: the model's internal statistics and weights are stripped. */
export function featureSchema(dataset: DatasetId): FeatureSchema {
  return {
    dataset,
    features: MODEL_FEATURES[dataset].map(({ mean: _mean, sd: _sd, weight: _weight, ...spec }) => spec),
    samplePatient: SAMPLE_PATIENTS[dataset],
    unusualPatient: UNUSUAL_PATIENTS[dataset],
  }
}
