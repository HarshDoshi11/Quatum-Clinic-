/**
 * THE single source of truth for mock numbers.
 *
 * Only the values in ANCHORS and NOISE_PROFILES are hand-written. Everything
 * else (sensitivity, specificity, accuracy, noise tolerance, thresholds, curves)
 * is derived from them below, so numbers agree on every page by construction.
 */
import { DATASETS } from '../../lib/domain'
import type { DatasetId, ExperimentMetrics, ModelId, NoiseParams } from '../../types'
import { logit, normCdf, normInv, round, sigmoid } from './math'

// ─── Anchors ────────────────────────────────────────────────

export interface ModelAnchor {
  auc: number
  aucStd: number
  trainTimeS: number
  inferenceMs: number
  qubits: number | null
  circuitDepth: number | null
}

export const ANCHORS: Record<DatasetId, Record<ModelId, ModelAnchor>> = {
  wdbc: {
    xgboost: { auc: 0.921, aucStd: 0.009, trainTimeS: 2.6, inferenceMs: 0.9, qubits: null, circuitDepth: null },
    qsvm: { auc: 0.914, aucStd: 0.012, trainTimeS: 184, inferenceMs: 38, qubits: 4, circuitDepth: 2 },
    vqc: { auc: 0.909, aucStd: 0.015, trainTimeS: 412, inferenceMs: 12, qubits: 8, circuitDepth: 3 },
    rf: { auc: 0.916, aucStd: 0.01, trainTimeS: 1.8, inferenceMs: 1.1, qubits: null, circuitDepth: null },
    svm: { auc: 0.911, aucStd: 0.011, trainTimeS: 0.21, inferenceMs: 0.3, qubits: null, circuitDepth: null },
    logreg: { auc: 0.907, aucStd: 0.01, trainTimeS: 0.04, inferenceMs: 0.02, qubits: null, circuitDepth: null },
  },
  heart: {
    xgboost: { auc: 0.903, aucStd: 0.014, trainTimeS: 1.4, inferenceMs: 0.7, qubits: null, circuitDepth: null },
    qsvm: { auc: 0.896, aucStd: 0.015, trainTimeS: 96, inferenceMs: 31, qubits: 4, circuitDepth: 2 },
    vqc: { auc: 0.889, aucStd: 0.018, trainTimeS: 238, inferenceMs: 10, qubits: 8, circuitDepth: 3 },
    rf: { auc: 0.898, aucStd: 0.015, trainTimeS: 1.1, inferenceMs: 0.9, qubits: null, circuitDepth: null },
    svm: { auc: 0.892, aucStd: 0.016, trainTimeS: 0.09, inferenceMs: 0.2, qubits: null, circuitDepth: null },
    logreg: { auc: 0.884, aucStd: 0.017, trainTimeS: 0.02, inferenceMs: 0.02, qubits: null, circuitDepth: null },
  },
}

export const SEEDS = 5
export const BEST_QUANTUM: ModelId = 'qsvm'
export const BEST_OVERALL: ModelId = 'xgboost'

/** Abstained test patients (of the 30% test split). WDBC: 7 / 171 = 4.1%. */
export const ABSTAINED: Record<DatasetId, number> = { wdbc: 7, heart: 4 }

/** Sensitivity must stay at or above this to count as safe. */
export const SAFE_SENSITIVITY = 0.85

/** Two-qubit gate error (%) at which WDBC/QSVM sensitivity reaches SAFE_SENSITIVITY on FakeBackend-1. */
export const WDBC_TOLERANCE_2Q = 1.2

export const NOISE_PROFILES = {
  ideal: { t1Us: null, t2Us: null, gateError1q: 0, gateError2q: 0, readoutError: 0, shots: null },
  noisySim: { t1Us: 300, t2Us: 250, gateError1q: 0.01, gateError2q: 0.1, readoutError: 0.5, shots: 4096 },
  fakeBackend1: { t1Us: 112, t2Us: 86, gateError1q: 0.04, gateError2q: 1.5, readoutError: 2.4, shots: 4096 },
  fakeBackend2: { t1Us: 186, t2Us: 142, gateError1q: 0.02, gateError2q: 0.8, readoutError: 1.3, shots: 4096 },
} satisfies Record<string, NoiseParams>

// ─── Operating points (equal-variance binormal ROC) ─────────

/** Separation d' of an equal-variance binormal ROC with the given AUC. */
export const dPrime = (auc: number): number => Math.SQRT2 * normInv(auc)

/** Threshold sits 0.25σ below the midpoint: screening favours sensitivity. */
const OPERATING_SHIFT = 0.25

export const prevalence = (dataset: DatasetId): number => DATASETS[dataset].positive / DATASETS[dataset].samples

export interface OperatingPointDetail {
  sensitivity: number
  specificity: number
  accuracy: number
  /** Decision threshold on the calibrated probability scale. */
  probThreshold: number
}

/** Calibrated posterior for a latent score s under the binormal model. */
export function scoreToProb(dataset: DatasetId, auc: number, s: number): number {
  const d = dPrime(auc)
  const pi = prevalence(dataset)
  return sigmoid(d * (s - d / 2) + logit(pi))
}

export function probToScore(dataset: DatasetId, auc: number, p: number): number {
  const d = dPrime(auc)
  const pi = prevalence(dataset)
  return (logit(p) - logit(pi)) / d + d / 2
}

export function sensSpecAtScore(auc: number, s: number): { sensitivity: number; specificity: number } {
  const d = dPrime(auc)
  return { sensitivity: normCdf(d - s), specificity: normCdf(s) }
}

export function operatingPoint(dataset: DatasetId, auc: number): OperatingPointDetail {
  const s = dPrime(auc) / 2 - OPERATING_SHIFT
  const { sensitivity, specificity } = sensSpecAtScore(auc, s)
  const pi = prevalence(dataset)
  return {
    sensitivity,
    specificity,
    accuracy: sensitivity * pi + specificity * (1 - pi),
    probThreshold: scoreToProb(dataset, auc, s),
  }
}

/** AUC implied by a sensitivity/specificity pair on an equal-variance binormal ROC. */
export const aucFromOperatingPoint = (sensitivity: number, specificity: number): number =>
  normCdf((normInv(sensitivity) + normInv(specificity)) / Math.SQRT2)

export function modelMetrics(dataset: DatasetId, model: ModelId, aucOverride?: number): ExperimentMetrics {
  const a = ANCHORS[dataset][model]
  const auc = aucOverride ?? a.auc
  const op = operatingPoint(dataset, auc)
  return {
    accuracy: { mean: round(op.accuracy), std: round(a.aucStd * 1.2) },
    sensitivity: { mean: round(op.sensitivity), std: round(a.aucStd * 1.8) },
    specificity: { mean: round(op.specificity), std: round(a.aucStd * 1.5) },
    auc: { mean: auc, std: a.aucStd },
    trainTimeS: { mean: a.trainTimeS, std: round(a.trainTimeS * 0.06, a.trainTimeS < 1 ? 3 : 1) },
    inferenceMs: { mean: a.inferenceMs, std: round(a.inferenceMs * 0.08, a.inferenceMs < 1 ? 3 : 1) },
  }
}

// ─── Hardware noise model (QSVM, 4 qubits) ──────────────────

/** Sensitivity loss (percentage points) from everything except the 2-qubit gate error. */
function otherNoiseDrop(n: NoiseParams): number {
  return 2 * n.gateError1q + 0.25 * n.readoutError + (n.t2Us ? 27.5 / n.t2Us : 0) + (n.t1Us ? 10 / n.t1Us : 0)
}

/** Sensitivity loss (pp) from data corruption (% of corrupted feature values). */
function corruptionDrop(corruptionPct: number, gateError2q: number): number {
  return 0.16 * corruptionPct + 0.02 * gateError2q * corruptionPct
}

/** QSVM benchmark ran on Noisy Sim, so its sensitivity is the Noisy Sim operating point. */
const noisySimSensPct = (dataset: DatasetId): number =>
  operatingPoint(dataset, ANCHORS[dataset].qsvm.auc).sensitivity * 100

/**
 * Sensitivity loss per 1% of two-qubit gate error — solved so that WDBC
 * sensitivity crosses SAFE_SENSITIVITY exactly at WDBC_TOLERANCE_2Q.
 */
const SLOPE_2Q: number = (() => {
  const ns = NOISE_PROFILES.noisySim
  const fb1 = NOISE_PROFILES.fakeBackend1
  return (
    (noisySimSensPct('wdbc') + otherNoiseDrop(ns) - otherNoiseDrop(fb1) - SAFE_SENSITIVITY * 100) /
    (WDBC_TOLERANCE_2Q - ns.gateError2q)
  )
})()

const idealSensPct = (dataset: DatasetId): number =>
  noisySimSensPct(dataset) + SLOPE_2Q * NOISE_PROFILES.noisySim.gateError2q + otherNoiseDrop(NOISE_PROFILES.noisySim)

export interface NoisyOperatingPoint {
  sensitivity: number
  specificity: number
  auc: number
}

export function noisyOperatingPoint(dataset: DatasetId, noise: NoiseParams, corruptionPct = 0): NoisyOperatingPoint {
  const base = operatingPoint(dataset, ANCHORS[dataset].qsvm.auc)
  const sensPct =
    idealSensPct(dataset) - SLOPE_2Q * noise.gateError2q - otherNoiseDrop(noise) - corruptionDrop(corruptionPct, noise.gateError2q)
  const sensitivity = Math.min(0.999, Math.max(0.5, sensPct / 100))
  // Specificity degrades at ~35% of the sensitivity rate, relative to the Noisy Sim benchmark.
  const specificity = Math.min(0.999, Math.max(0.5, base.specificity + 0.35 * (sensitivity - base.sensitivity)))
  return { sensitivity, specificity, auc: aucFromOperatingPoint(sensitivity, specificity) }
}

/** Two-qubit gate error (%) where sensitivity reaches SAFE_SENSITIVITY, other noise at FakeBackend-1 levels. */
export function toleranceGateError2q(dataset: DatasetId): number {
  return (idealSensPct(dataset) - otherNoiseDrop(NOISE_PROFILES.fakeBackend1) - SAFE_SENSITIVITY * 100) / SLOPE_2Q
}

/** Sensitivity std (fraction): seed spread + shot noise. */
export function noisySensitivityStd(noise: NoiseParams): number {
  return (0.6 + (noise.shots ? 40 / Math.sqrt(noise.shots) : 0) + noise.gateError2q * 0.4) / 100
}
