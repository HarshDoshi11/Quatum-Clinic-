/**
 * The results store: ONE function from (dataset, model, config) to a result.
 *
 * Every page — Train, Advantage Observatory, Scalability, Model Evolution, the
 * experiment registry, the status strip — reads its numbers from here, so a given
 * configuration shows the same AUC everywhere. Values are deterministic
 * functions of the anchors in canon.ts; a dev-only registry warns if the same
 * config key is ever reported with two different values.
 */
import { MODELS } from '../../lib/domain'
import type { Ansatz, BackendId, ConfigKey, DatasetId, Encoding, Entanglement, ExperimentMetrics, MeanStd, ModalityId, ModelId, NoiseParams } from '../../types'
import { ANCHORS, MODALITY_ANCHORS, NOISE_PROFILES, SEEDS, metricsFor, metricsFromPoint, noiseDropPct, noisyOperatingPoint, noisySensitivityStd } from './canon'
import { hashSeed, round, samplesWithStats } from './math'

export interface ModelConfig {
  model: ModelId
  /** null for classical models. */
  qubits: number | null
  encoding: Encoding | null
  circuitDepth: number | null
  entanglement: Entanglement | null
  backend: BackendId
  /** Trained on this modality's features only (cross-modality study); absent = all features. */
  modality?: ModalityId
}

export interface ConfigResult {
  key: ConfigKey
  dataset: DatasetId
  config: ModelConfig
  ansatz: Ansatz | null
  /** Trainable circuit parameters; null for classical models, 0 for the fixed-kernel QSVM. */
  parameters: number | null
  auc: MeanStd
  /** Per-seed AUCs whose mean and std are exactly `auc`. */
  seeds: number[]
  trainTimeS: number
  inferenceMs: number
  metrics: ExperimentMetrics
}

// ─── Configurations ─────────────────────────────────────────

/** Backend each model is benchmarked on (the Train page uses the same). */
export const DEFAULT_BACKEND: Record<ModelId, BackendId> = {
  vqc: 'ideal-sim',
  qsvm: 'noisy-sim',
  logreg: 'cpu',
  svm: 'cpu',
  rf: 'cpu',
  xgboost: 'cpu',
}

/** QSVM uses a fixed two-repetition ZZ feature map with full entanglement. */
export const QSVM_REPS = 2

/** The benchmark configuration of each model (the one the Observatory reports). */
export function referenceConfig(dataset: DatasetId, model: ModelId): ModelConfig {
  const a = ANCHORS[dataset][model]
  if (MODELS[model].family === 'classical') {
    return { model, qubits: null, encoding: null, circuitDepth: null, entanglement: null, backend: 'cpu' }
  }
  return {
    model,
    qubits: a.qubits,
    encoding: 'angle',
    circuitDepth: model === 'qsvm' ? QSVM_REPS : a.circuitDepth,
    entanglement: model === 'qsvm' ? 'full' : 'linear',
    backend: DEFAULT_BACKEND[model],
  }
}

/** Normalise a requested config (QSVM ignores depth/encoding/entanglement: its feature map is fixed). */
export function normalise(c: ModelConfig): ModelConfig {
  if (MODELS[c.model].family === 'classical') {
    const base: ModelConfig = { model: c.model, qubits: null, encoding: null, circuitDepth: null, entanglement: null, backend: 'cpu' }
    return c.modality ? { ...base, modality: c.modality } : base
  }
  if (c.model === 'qsvm') return { ...c, encoding: 'angle', circuitDepth: QSVM_REPS, entanglement: 'full' }
  return c
}

export function configKey(dataset: DatasetId, raw: ModelConfig): ConfigKey {
  const c = normalise(raw)
  const subset = c.modality ? `|only-${c.modality}` : ''
  if (c.qubits === null) return `${dataset}|${c.model}|${c.backend}${subset}`
  return `${dataset}|${c.model}|${c.qubits}q|${c.encoding}|d${c.circuitDepth}|${c.entanglement}|${c.backend}${subset}`
}

// ─── Parameter formulas ─────────────────────────────────────

/**
 * Full entanglement uses StronglyEntanglingLayers (3 rotations per qubit per
 * layer: 3·q·d). Linear / circular use a RealAmplitudes-style ansatz (one RY per
 * qubit per layer plus a final rotation layer: q·(d+1)). QSVM's ZZ kernel has
 * no trainable circuit parameters.
 */
export function ansatzFor(c: ModelConfig): Ansatz | null {
  if (c.qubits === null) return null
  if (c.model === 'qsvm') return 'zz-kernel'
  return c.entanglement === 'full' ? 'strongly-entangling' : 'real-amplitudes'
}

export function trainableParameters(c: ModelConfig): number | null {
  const ansatz = ansatzFor(c)
  if (ansatz === null || c.qubits === null) return null
  const q = c.qubits
  const d = c.circuitDepth ?? 1
  switch (ansatz) {
    case 'strongly-entangling':
      return 3 * q * d
    case 'real-amplitudes':
      return q * (d + 1)
    case 'zz-kernel':
      return 0
  }
}

export const ANSATZ_LABEL: Record<Ansatz, string> = {
  'strongly-entangling': 'StronglyEntanglingLayers',
  'real-amplitudes': 'RealAmplitudes',
  'zz-kernel': 'ZZ feature-map kernel',
}

// ─── AUC surfaces ───────────────────────────────────────────

const NOISE_BY_BACKEND: Record<BackendId, NoiseParams> = {
  'ideal-sim': NOISE_PROFILES.ideal,
  'noisy-sim': NOISE_PROFILES.noisySim,
  'fake-backend-1': NOISE_PROFILES.fakeBackend1,
  'fake-backend-2': NOISE_PROFILES.fakeBackend2,
  'ibm-qpu': NOISE_PROFILES.fakeBackend1,
  cpu: NOISE_PROFILES.ideal,
}

const VQC_QUBIT_TERM: Record<number, number> = { 4: -0.006, 6: -0.003, 8: 0, 10: -0.001, 12: -0.004 }
/** Depth helps up to 3 layers, then trainability suffers (relative to depth 3). */
const VQC_DEPTH_TERM: Record<number, number> = { 1: -0.017, 2: -0.007, 3: 0, 4: -0.003 }
const QSVM_QUBIT_TERM: Record<number, number> = { 4: 0, 6: -0.003, 8: -0.008 }

function vqcAuc(dataset: DatasetId, c: ModelConfig, key: ConfigKey): number {
  const anchor = ANCHORS[dataset].vqc
  const ref = referenceConfig(dataset, 'vqc')
  const q = c.qubits ?? 8
  const d = c.circuitDepth ?? 3
  const isRef = q === ref.qubits && d === ref.circuitDepth && c.encoding === ref.encoding && c.entanglement === ref.entanglement
  let ideal = anchor.auc
  if (!isRef) {
    const ent = c.entanglement === 'full' ? (d >= 4 ? -0.007 : -0.002) : c.entanglement === 'circular' ? 0.001 : 0
    const enc = c.encoding === 'amplitude' ? -0.008 : 0
    const jitter = ((hashSeed(key.replace(/\|[^|]+$/, '')) % 1000) / 1000 - 0.5) * 0.004
    ideal = Math.min(anchor.auc - 0.001, anchor.auc + (VQC_QUBIT_TERM[q] ?? -0.006) + (VQC_DEPTH_TERM[d] ?? -0.01) + ent + enc + jitter)
  }
  // Hardware noise: the same sensitivity-loss model as the Hardware Lab, scaled by circuit size.
  const drop = (noiseDropPct(NOISE_BY_BACKEND[c.backend]) / 100) * 0.35 * ((q * d) / 12)
  return round(ideal - drop)
}

function qsvmAuc(dataset: DatasetId, c: ModelConfig): number {
  // The noiseless → noisy behaviour comes from the Hardware Lab model, so the two always agree.
  const base = noisyOperatingPoint(dataset, NOISE_BY_BACKEND[c.backend]).auc
  return round(base + (QSVM_QUBIT_TERM[c.qubits ?? 4] ?? -0.01))
}

function aucStd(dataset: DatasetId, c: ModelConfig): number {
  const a = ANCHORS[dataset][c.model]
  if (c.qubits === null || c.model === 'qsvm') return round(a.aucStd * (1 + ((c.qubits ?? 4) - 4) * 0.05), 4)
  const q = c.qubits
  const d = c.circuitDepth ?? 3
  return round(a.aucStd * (1 + (q - 8) * 0.05 + (d - 3) * 0.08), 4)
}

/**
 * QSVM on a backend: sensitivity and specificity come from the hardware noise
 * model, so the Hardware Lab and the Failure Envelope read these exact values.
 */
function qsvmMetrics(dataset: DatasetId, c: ModelConfig, auc: number, std: number, trainTimeS: number, inferenceMs: number): ExperimentMetrics {
  const noise = NOISE_BY_BACKEND[c.backend]
  const op = noisyOperatingPoint(dataset, noise)
  const sensStd = noisySensitivityStd(noise)
  return metricsFromPoint(
    dataset,
    auc,
    std,
    { sensitivity: op.sensitivity, sensitivityStd: sensStd, specificity: op.specificity, specificityStd: sensStd * 0.8 },
    trainTimeS,
    inferenceMs,
  )
}

// ─── Store + consistency registry ───────────────────────────

const cache = new Map<ConfigKey, ConfigResult>()

export function result(dataset: DatasetId, raw: ModelConfig): ConfigResult {
  const config = normalise(raw)
  const key = configKey(dataset, config)
  const hit = cache.get(key)
  if (hit) return hit

  const a = ANCHORS[dataset][config.model]
  // A single-modality run reads its own anchor; everything else derives from the model anchor.
  const subset = config.modality ? MODALITY_ANCHORS[dataset]?.[config.modality] : undefined
  if (config.modality && !subset) throw new Error(`No ${config.modality}-only result for ${dataset}`)
  const auc = subset
    ? subset.auc
    : config.model === 'vqc' ? vqcAuc(dataset, config, key) : config.model === 'qsvm' ? qsvmAuc(dataset, config) : a.auc
  const std = subset ? subset.aucStd : aucStd(dataset, config)
  const q = config.qubits ?? 0
  const d = config.circuitDepth ?? 1
  const scale = config.model === 'vqc' ? (q / 8) ** 3.1 * (d / 3) : config.model === 'qsvm' ? (q / 4) ** 2 : 1
  const trainTimeS = round(a.trainTimeS * scale, a.trainTimeS * scale < 10 ? 2 : 0)
  const inferenceMs = round(a.inferenceMs * (config.model === 'vqc' ? (q / 8) * (d / 3) : config.model === 'qsvm' ? q / 4 : 1), 3)

  const out: ConfigResult = {
    key,
    dataset,
    config,
    ansatz: ansatzFor(config),
    parameters: trainableParameters(config),
    auc: { mean: auc, std },
    seeds: samplesWithStats(SEEDS, auc, std, hashSeed(key)).map((v) => round(v, 4)),
    trainTimeS,
    inferenceMs,
    metrics:
      config.model === 'qsvm' && !subset
        ? qsvmMetrics(dataset, config, auc, std, trainTimeS, inferenceMs)
        : metricsFor(dataset, auc, std, trainTimeS, inferenceMs),
  }
  cache.set(key, out)
  return out
}

export const referenceResult = (dataset: DatasetId, model: ModelId): ConfigResult => result(dataset, referenceConfig(dataset, model))

/** Best model by benchmark AUC, optionally within one family. */
export function bestModel(dataset: DatasetId, family?: 'quantum' | 'classical'): ModelId {
  const candidates = (Object.keys(ANCHORS[dataset]) as ModelId[]).filter((m) => !family || MODELS[m].family === family)
  return candidates.reduce((a, b) => (referenceResult(dataset, b).auc.mean > referenceResult(dataset, a).auc.mean ? b : a))
}

/**
 * Consistency guard: every (config key → AUC) pair that leaves the mock layer is
 * recorded; a second, different value for the same key is reported.
 */
const seen = new Map<string, number>()
export function recordConsistency(key: ConfigKey, field: string, value: number, where: string): string | null {
  const id = `${key}#${field}`
  const prev = seen.get(id)
  if (prev === undefined) {
    seen.set(id, value)
    return null
  }
  return Math.abs(prev - value) > 1e-9 ? `${key} ${field}: ${prev} vs ${value} (${where})` : null
}

/** Walks any response object and checks every `{ configKey, auc }` pair it contains. */
export function checkResponseConsistency(value: unknown, where: string): string[] {
  const problems: string[] = []
  const visit = (v: unknown) => {
    if (Array.isArray(v)) {
      v.forEach(visit)
      return
    }
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      if (typeof o.configKey === 'string') {
        const num = (x: unknown) => (typeof x === 'number' ? x : x && typeof x === 'object' && typeof (x as MeanStd).mean === 'number' ? (x as MeanStd).mean : undefined)
        const metrics = o.metrics && typeof o.metrics === 'object' ? (o.metrics as Record<string, unknown>) : undefined
        // AUC and sensitivity must agree wherever a config appears: flat (noise runs, envelope) or nested (experiments, compare rows).
        for (const field of ['auc', 'sensitivity'] as const) {
          const value = num(o[field]) ?? num(metrics?.[field])
          if (value === undefined) continue
          const p = recordConsistency(o.configKey, field, value, where)
          if (p) problems.push(p)
        }
      }
      Object.values(o).forEach(visit)
    }
  }
  visit(value)
  return problems
}
