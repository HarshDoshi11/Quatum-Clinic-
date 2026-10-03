/**
 * The hand-written anchors of the mock data.
 *
 * Only ANCHORS (each model's benchmark configuration) and NOISE_PROFILES are
 * written by hand. Every displayed result is derived from them by the results
 * store (results.ts), keyed by dataset + model + config, so the same config shows
 * the same number on every page by construction.
 *
 * WDBC is realistic for this dataset (classical AUC ≈ 0.99, accuracy ≈ 95–96%);
 * Heart keeps its harder profile (classical AUC ≈ 0.88–0.90, accuracy ≈ 80–81%).
 */
import { DATASETS, SEEDS } from '../../lib/domain'
import type { DataSource, DatasetId, ExperimentMetrics, ModalityId, ModelId, NoiseParams } from '../../types'
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
    xgboost: { auc: 0.993, aucStd: 0.004, trainTimeS: 2.6, inferenceMs: 0.9, qubits: null, circuitDepth: null },
    qsvm: { auc: 0.984, aucStd: 0.006, trainTimeS: 184, inferenceMs: 38, qubits: 4, circuitDepth: 2 },
    vqc: { auc: 0.972, aucStd: 0.009, trainTimeS: 412, inferenceMs: 12, qubits: 8, circuitDepth: 3 },
    rf: { auc: 0.991, aucStd: 0.005, trainTimeS: 1.8, inferenceMs: 1.1, qubits: null, circuitDepth: null },
    svm: { auc: 0.994, aucStd: 0.003, trainTimeS: 0.21, inferenceMs: 0.3, qubits: null, circuitDepth: null },
    logreg: { auc: 0.992, aucStd: 0.004, trainTimeS: 0.04, inferenceMs: 0.02, qubits: null, circuitDepth: null },
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

export { SEEDS }

/** Every mock response is simulated; the real pipeline (ml/) marks its own fixtures `real`. */
export const SIMULATED: DataSource = { kind: 'simulated', seeds: SEEDS }
/** The quantum model the patient-facing pages deploy (the best quantum model on both datasets). */
export const BEST_QUANTUM: ModelId = 'qsvm'

/** Abstained test patients (of the 30% test split). WDBC: 7 / 171 = 4.1%. */
export const ABSTAINED: Record<DatasetId, number> = { wdbc: 7, heart: 4 }

/**
 * Benchmark QSVM trained on one modality's features only (5 seeds, same split).
 * All modalities together is the benchmark QSVM itself, so it has no entry here.
 * Only datasets whose config declares two or more modalities appear.
 */
export const MODALITY_ANCHORS: Partial<Record<DatasetId, Partial<Record<ModalityId, { auc: number; aucStd: number }>>>> = {
  heart: {
    demographics: { auc: 0.712, aucStd: 0.031 },
    symptoms: { auc: 0.781, aucStd: 0.026 },
    ecg: { auc: 0.758, aucStd: 0.028 },
    exercise: { auc: 0.844, aucStd: 0.021 },
    labs: { auc: 0.694, aucStd: 0.033 },
  },
}

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

/**
 * Decision threshold, in σ below the ROC midpoint. WDBC is diagnostic cytology
 * (near-balanced, slight sensitivity lean); Heart is screening, so it leans harder toward sensitivity.
 */
const OPERATING_SHIFT: Record<DatasetId, number> = { wdbc: 0.08, heart: 0.25 }

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
  const s = dPrime(auc) / 2 - OPERATING_SHIFT[dataset]
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

/** Full metric set for one configuration's AUC ± std and timings (used by the results store). */
export function metricsFor(dataset: DatasetId, auc: number, aucStd: number, trainTimeS: number, inferenceMs: number): ExperimentMetrics {
  const op = operatingPoint(dataset, auc)
  return {
    accuracy: { mean: round(op.accuracy), std: round(aucStd * 1.2) },
    sensitivity: { mean: round(op.sensitivity), std: round(aucStd * 1.8) },
    specificity: { mean: round(op.specificity), std: round(aucStd * 1.5) },
    auc: { mean: auc, std: aucStd },
    trainTimeS: { mean: trainTimeS, std: round(trainTimeS * 0.06, trainTimeS < 1 ? 3 : 1) },
    inferenceMs: { mean: inferenceMs, std: round(inferenceMs * 0.08, inferenceMs < 1 ? 4 : 2) },
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

/**
 * Metrics from an explicit operating point (sensitivity/specificity with their std),
 * used for QSVM on a hardware backend where the noise model — not the AUC alone —
 * decides the operating point.
 */
export function metricsFromPoint(
  dataset: DatasetId,
  auc: number,
  aucStd: number,
  point: { sensitivity: number; sensitivityStd: number; specificity: number; specificityStd: number },
  trainTimeS: number,
  inferenceMs: number,
): ExperimentMetrics {
  const pi = prevalence(dataset)
  const acc = point.sensitivity * pi + point.specificity * (1 - pi)
  return {
    accuracy: { mean: round(acc), std: round(aucStd * 1.2) },
    sensitivity: { mean: round(point.sensitivity), std: round(point.sensitivityStd, 4) },
    specificity: { mean: round(point.specificity), std: round(point.specificityStd, 4) },
    auc: { mean: auc, std: aucStd },
    trainTimeS: { mean: trainTimeS, std: round(trainTimeS * 0.06, trainTimeS < 1 ? 3 : 1) },
    inferenceMs: { mean: inferenceMs, std: round(inferenceMs * 0.08, inferenceMs < 1 ? 4 : 2) },
  }
}

/** Sensitivity lost (percentage points) to hardware noise, relative to the noiseless circuit. */
export function noiseDropPct(noise: NoiseParams): number {
  return SLOPE_2Q * noise.gateError2q + otherNoiseDrop(noise)
}

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
