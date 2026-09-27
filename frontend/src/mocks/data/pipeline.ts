/**
 * The one preprocessing + PCA pipeline. Training, Predict, Explain's what-if
 * sliders and the Data page's demo encoding all pass patient values through
 * this, so a what-if change is treated exactly like a new patient:
 *
 *   raw features → impute missing (training mean) → clip to training range
 *   → standardise (z) → PCA (4 components) → angle encoding in [0, 1] per qubit
 *
 * PCA loadings are derived from the plain-words component meanings below (each
 * component loads mainly on its drivers, with a small deterministic spread on
 * every other feature), then orthonormalised. Components are oriented so a
 * higher value reads as higher risk — the Bloch panel relies on that.
 */
import type { DatasetId, PatientInput } from '../../types'
import { MODEL_FEATURES, type ModelFeature } from './features'
import { hashSeed, rng, round } from './math'

export const PCA_DIMS = 4

/** What each principal component mostly captures (from its loadings), in plain words. */
export const PCA_MEANING: Record<DatasetId, { label: string; drivers: string[] }[]> = {
  wdbc: [
    { label: 'mostly tumor size', drivers: ['radius', 'perimeter', 'area', 'concave points'] },
    { label: 'mostly edge smoothness', drivers: ['smoothness', 'fractal dimension'] },
    { label: 'mostly cell texture', drivers: ['texture'] },
    { label: 'mostly shape symmetry', drivers: ['symmetry', 'compactness'] },
    { label: 'mixed shape detail', drivers: ['concavity', 'compactness'] },
    { label: 'mixed texture detail', drivers: ['texture', 'smoothness'] },
    { label: 'residual variation', drivers: [] },
    { label: 'residual variation', drivers: [] },
  ],
  heart: [
    { label: 'mostly exercise response', drivers: ['max heart rate', 'st depression', 'exercise angina'] },
    { label: 'mostly age and blood pressure', drivers: ['age', 'resting bp'] },
    { label: 'mostly chest pain type', drivers: ['chest pain type', 'st slope'] },
    { label: 'mostly cholesterol and blood sugar', drivers: ['cholesterol', 'fasting sugar'] },
    { label: 'mostly scan findings', drivers: ['thallium scan', 'major vessels'] },
    { label: 'mostly resting ECG', drivers: ['resting ecg'] },
    { label: 'mostly sex', drivers: ['sex'] },
    { label: 'residual variation', drivers: [] },
  ],
}

/** Angle encoding maps ±ENCODE_SD standard deviations of a component onto [0, 1]. */
const ENCODE_SD = 3

const isDriver = (f: ModelFeature, drivers: string[]) => drivers.some((d) => f.label.toLowerCase().startsWith(d))

interface Pca {
  /** PCA_DIMS × features, orthonormal rows. */
  loadings: number[][]
  /** Model weight per component (log-odds per unit component, before calibration scaling). */
  componentWeights: number[]
  /** The same weights expressed per original (standardised) feature: Σₖ wₖ·Lₖⱼ. */
  featureWeights: number[]
}

function buildPca(dataset: DatasetId): Pca {
  const features = MODEL_FEATURES[dataset]
  const next = rng(hashSeed(`pca-${dataset}`))
  const raw = PCA_MEANING[dataset].slice(0, PCA_DIMS).map(({ drivers }) =>
    features.map((f) => {
      const sign = f.weight < 0 ? -1 : 1
      return sign * (isDriver(f, drivers) ? 1 : 0.1 + 0.2 * next())
    }),
  )
  // Gram–Schmidt → orthonormal loadings.
  const loadings: number[][] = []
  for (const v of raw) {
    const u = [...v]
    for (const q of loadings) {
      const dot = u.reduce((s, x, j) => s + x * q[j], 0)
      for (let j = 0; j < u.length; j++) u[j] -= dot * q[j]
    }
    const norm = Math.hypot(...u)
    loadings.push(u.map((x) => x / norm))
  }
  // The model sees only the components: project the feature weights onto them,
  // and orient each component so that a higher value means higher risk.
  const componentWeights = loadings.map((row, k) => {
    const w = row.reduce((s, l, j) => s + l * features[j].weight, 0)
    if (w < 0) loadings[k] = row.map((l) => -l)
    return Math.abs(w)
  })
  const featureWeights = features.map((_, j) => loadings.reduce((s, row, k) => s + componentWeights[k] * row[j], 0))
  return { loadings, componentWeights, featureWeights }
}

export const PCA: Record<DatasetId, Pca> = { wdbc: buildPca('wdbc'), heart: buildPca('heart') }

export type Adjustment = 'imputed' | 'clipped' | null

export interface Preprocessed {
  /** Per feature, in MODEL_FEATURES order. */
  features: { feature: ModelFeature; raw: number | null; used: number; z: number; adjustment: Adjustment }[]
  /** Component scores (standardised units). */
  components: number[]
  /** Angle-encoding inputs, one per qubit, in [0, 1]. */
  encoding: number[]
}

/** Runs one patient through the training pipeline. */
export function preprocess(dataset: DatasetId, input: PatientInput): Preprocessed {
  const features = MODEL_FEATURES[dataset].map((f) => {
    const raw = input[f.key] ?? null
    const missing = raw === null || Number.isNaN(raw)
    const clipped = missing ? f.mean : Math.min(f.max, Math.max(f.min, raw))
    const adjustment: Adjustment = missing ? 'imputed' : clipped !== raw ? 'clipped' : null
    return { feature: f, raw: missing ? null : raw, used: clipped, z: (clipped - f.mean) / f.sd, adjustment }
  })
  const components = PCA[dataset].loadings.map((row) => row.reduce((s, l, j) => s + l * features[j].z, 0))
  const encoding = components.map((c) => round(Math.min(1, Math.max(0, 0.5 + c / (2 * ENCODE_SD))), 2))
  return { features, components, encoding }
}
