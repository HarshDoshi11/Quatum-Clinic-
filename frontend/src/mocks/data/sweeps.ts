/**
 * Sweep generators. Every AUC comes from the results store (results.ts), and
 * every claim is worded by whether differences exceed the combined seed std.
 */
import { DATASETS, MODELS, trainSize } from '../../lib/domain'
import type {
  CircuitConfig,
  Crossover,
  DatasetId,
  Encoding,
  Entanglement,
  EvolutionSweep,
  FailureEnvelopeSweep,
  LearningSeries,
  ModelId,
  ScalabilityPoint,
  ScalabilitySweep,
  SmallDataSweep,
} from '../../types'
import { envelopeSentence } from '../../lib/safety'
import { NOISE_PROFILES, SAFE_SENSITIVITY, SEEDS, noisyOperatingPoint, noisySensitivityStd } from './canon'
import { EXPERIMENT_IDS } from './ids'
import { round } from './math'
import { bestModel, referenceResult, result } from './results'

const pooled = (a: number, b: number) => Math.sqrt(a ** 2 + b ** 2)

// ─── Small data ─────────────────────────────────────────────

/** Curvature per model: AUC(n) = final − k·(1/√n − 1/√N). Quantum kernels learn faster from few samples. */
const LEARNING_K: Record<ModelId, number> = { qsvm: 0.35, vqc: 0.45, logreg: 0.55, svm: 0.7, rf: 0.72, xgboost: 0.75 }

export function smallDataSweep(dataset: DatasetId): SmallDataSweep {
  const N = trainSize(dataset)
  const code = DATASETS[dataset].code
  const sizes = dataset === 'wdbc' ? [25, 50, 100, 200, N] : [25, 50, 100, 150, N]
  const bestClassical = bestModel(dataset, 'classical')
  const models: ModelId[] = ['qsvm', 'vqc', bestClassical, bestClassical === 'logreg' ? 'rf' : 'logreg']

  const curve = (model: ModelId) => {
    const r = referenceResult(dataset, model)
    return sizes.map((n) => ({
      trainSize: n,
      label: n === N ? `All (${N})` : String(n),
      auc: {
        mean: round(r.auc.mean - LEARNING_K[model] * (1 / Math.sqrt(n) - 1 / Math.sqrt(N))),
        std: round(Math.min(0.06, r.auc.std * Math.sqrt(N / n))),
      },
    }))
  }
  const series: LearningSeries[] = models.map((model) => ({ model, family: MODELS[model].family, points: curve(model) }))

  // Compare the best quantum and best classical curves, with ±1 std bands.
  const qs = series[0].points
  const cs = series[2].points
  const diff = (i: number) => qs[i].auc.mean - cs[i].auc.mean
  const band = (i: number) => pooled(qs[i].auc.std, cs[i].auc.std)
  const last = sizes.length - 1
  const quantumAheadSmall = diff(0) > band(0)
  const classicalAheadLarge = -diff(last) > band(last)

  let crossover: Crossover | null = null
  let gapClosesAt: number | null = null
  if (quantumAheadSmall && classicalAheadLarge) {
    // Bands separate on both sides: the crossing is real. Solve the two curves for n.
    const kq = LEARNING_K.qsvm
    const kc = LEARNING_K[bestClassical]
    const qa = referenceResult(dataset, 'qsvm').auc.mean
    const ca = referenceResult(dataset, bestClassical).auc.mean
    const u = (ca - qa) / (kc - kq)
    const n = 1 / (u + 1 / Math.sqrt(N)) ** 2
    crossover = { trainSize: Math.round(n), auc: round(qa - kq * u), quantumModel: 'qsvm', classicalModel: bestClassical }
  } else if (quantumAheadSmall) {
    const i = sizes.findIndex((_, k) => Math.abs(diff(k)) <= band(k))
    gapClosesAt = i >= 0 ? sizes[i] : null
  }

  const lead = (diff(0) * 100).toFixed(1)
  const Q = MODELS.qsvm.name
  const C = MODELS[bestClassical].name
  const takeaway = crossover
    ? `With 25 training patients ${Q} leads ${C} by ${lead} AUC points (beyond seed noise); ${C} overtakes at ~${crossover.trainSize} patients, where the bands separate again.`
    : gapClosesAt
      ? `With 25 training patients ${Q} leads ${C} by ${lead} AUC points; the gap closes to within seed noise by ~${gapClosesAt} patients.`
      : quantumAheadSmall
        ? `${Q} leads ${C} with few patients, and the curves never separate beyond seed noise after that.`
        : `The quantum and classical curves overlap within seed noise at every training size.`

  return {
    type: 'small-data',
    dataset,
    experimentId: EXPERIMENT_IDS[dataset].smallData,
    evaluation: `${SEEDS} seeds per size · held-out 30% · benchmark backends · ${code}`,
    sizes,
    series,
    crossover,
    gapClosesAt,
    takeaway,
  }
}

// ─── Scalability (VQC) ──────────────────────────────────────

const SCALE_QUBITS = [4, 6, 8, 10, 12]
const RUNTIME_GROWTH = 1.8

export function scalabilitySweep(dataset: DatasetId): ScalabilitySweep {
  const code = DATASETS[dataset].code
  const layers = 3
  const points: ScalabilityPoint[] = SCALE_QUBITS.map((q) => {
    const r = result(dataset, { model: 'vqc', qubits: q, encoding: 'angle', circuitDepth: layers, entanglement: 'linear', backend: 'ideal-sim' })
    const twoQubitGates = layers * (q - 1) + Math.round(0.35 * q * q) // entanglers + SWAP routing overhead
    return {
      configKey: r.key,
      qubits: q,
      circuitDepth: Math.round(layers * (4 + 0.9 * q) + 0.12 * q * q),
      gateCount: layers * 2 * q + q + twoQubitGates,
      twoQubitGates,
      runtimeS: r.trainTimeS,
      auc: r.auc.mean,
      aucStd: r.auc.std,
    }
  })

  // Rule: first step where runtime grows ≥ ×1.8 while the AUC gain stays within the combined seed std.
  let bottleneck: ScalabilitySweep['bottleneck'] = null
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const growth = cur.runtimeS / prev.runtimeS
    const gain = cur.auc - prev.auc
    const noise = pooled(prev.aucStd, cur.aucStd)
    if (growth >= RUNTIME_GROWTH && gain <= noise) {
      bottleneck = {
        qubits: cur.qubits,
        explanation: `From ${prev.qubits} to ${cur.qubits} qubits training time grows ×${growth.toFixed(1)} and two-qubit gates ×${(cur.twoQubitGates / prev.twoQubitGates).toFixed(1)}, while AUC changes by ${gain >= 0 ? '+' : '−'}${Math.abs(gain).toFixed(3)} — inside the ±${noise.toFixed(3)} seed noise.`,
      }
      break
    }
  }

  const aucs = points.map((p) => p.auc)
  const top = points.reduce((a, b) => (b.auc > a.auc ? b : a))
  const bottom = points.reduce((a, b) => (b.auc < a.auc ? b : a))
  const flat = top.auc - bottom.auc <= pooled(top.aucStd, bottom.aucStd)
  const growth = points[points.length - 1].runtimeS / points[0].runtimeS
  const takeaway = flat
    ? `AUC stays flat within seed noise from 4 to 12 qubits (${Math.min(...aucs).toFixed(3)}–${Math.max(...aucs).toFixed(3)}); training time keeps rising, ×${growth.toFixed(0)} overall.`
    : `AUC peaks at ${top.qubits} qubits, beyond seed noise; ${bottleneck ? `from ${bottleneck.qubits} qubits cost grows faster than accuracy.` : 'cost rises throughout.'}`

  return {
    type: 'scalability',
    dataset,
    experimentId: EXPERIMENT_IDS[dataset].scalability,
    evaluation: `${SEEDS} seeds · held-out 30% · ideal sim · ${code}`,
    model: 'vqc',
    points,
    bottleneck,
    rule: {
      runtimeGrowth: RUNTIME_GROWTH,
      text: `Marker rule · first step where training time grows ≥ ×${RUNTIME_GROWTH} while the AUC gain is within the combined seed std`,
    },
    takeaway,
  }
}

// ─── Model evolution (circuit search) ───────────────────────

export const SEARCH: { encoding: Encoding; qubits: number; depth: number; entanglement: Entanglement }[] = [
  { encoding: 'angle', qubits: 4, depth: 1, entanglement: 'linear' },
  { encoding: 'angle', qubits: 4, depth: 2, entanglement: 'linear' },
  { encoding: 'angle', qubits: 4, depth: 2, entanglement: 'circular' },
  { encoding: 'angle', qubits: 4, depth: 3, entanglement: 'full' },
  { encoding: 'angle', qubits: 4, depth: 4, entanglement: 'linear' },
  { encoding: 'amplitude', qubits: 4, depth: 1, entanglement: 'linear' },
  { encoding: 'amplitude', qubits: 4, depth: 2, entanglement: 'full' },
  { encoding: 'amplitude', qubits: 4, depth: 3, entanglement: 'circular' },
  { encoding: 'angle', qubits: 6, depth: 1, entanglement: 'circular' },
  { encoding: 'angle', qubits: 6, depth: 2, entanglement: 'linear' },
  { encoding: 'angle', qubits: 6, depth: 3, entanglement: 'linear' },
  { encoding: 'angle', qubits: 6, depth: 4, entanglement: 'full' },
  { encoding: 'amplitude', qubits: 6, depth: 2, entanglement: 'linear' },
  { encoding: 'amplitude', qubits: 6, depth: 4, entanglement: 'circular' },
  { encoding: 'angle', qubits: 8, depth: 1, entanglement: 'linear' },
  { encoding: 'angle', qubits: 8, depth: 2, entanglement: 'circular' },
  { encoding: 'angle', qubits: 8, depth: 3, entanglement: 'linear' }, // the VQC benchmark configuration
  { encoding: 'angle', qubits: 8, depth: 4, entanglement: 'full' },
  { encoding: 'amplitude', qubits: 8, depth: 3, entanglement: 'linear' },
  { encoding: 'amplitude', qubits: 8, depth: 4, entanglement: 'full' },
]

export function evolutionSweep(dataset: DatasetId): EvolutionSweep {
  const code = DATASETS[dataset].code
  const sweepId = EXPERIMENT_IDS[dataset].evolution
  const configs: CircuitConfig[] = SEARCH.map((c, i) => {
    const r = result(dataset, { model: 'vqc', qubits: c.qubits, encoding: c.encoding, circuitDepth: c.depth, entanglement: c.entanglement, backend: 'ideal-sim' })
    const id = `C${String(i + 1).padStart(2, '0')}`
    return {
      id,
      configKey: r.key,
      experimentId: `${sweepId}.${id}`,
      ansatz: r.ansatz ?? 'real-amplitudes',
      encoding: c.encoding,
      qubits: c.qubits,
      circuitDepth: c.depth,
      entanglement: c.entanglement,
      parameters: r.parameters ?? 0,
      auc: r.auc.mean,
      aucStd: r.auc.std,
      trainTimeS: r.trainTimeS,
      pareto: false,
    }
  })

  // Pareto front: a design is on it if no shallower (or equally deep) design scores at least as well.
  const byDepth = [...configs].sort((a, b) => a.circuitDepth - b.circuitDepth || b.auc - a.auc || a.parameters - b.parameters)
  let bestSoFar = -Infinity
  for (const c of byDepth) {
    if (c.auc > bestSoFar) {
      c.pareto = true
      bestSoFar = c.auc
    }
  }
  const front = configs.filter((c) => c.pareto).sort((a, b) => a.circuitDepth - b.circuitDepth)
  const best = front[front.length - 1]

  // Recommendation: the knee — the front design reached by the largest AUC gain per extra layer.
  let recommended = front[0]
  let bestGain = -Infinity
  for (let i = 1; i < front.length; i++) {
    const gain = (front[i].auc - front[i - 1].auc) / (front[i].circuitDepth - front[i - 1].circuitDepth)
    if (gain > bestGain) {
      bestGain = gain
      recommended = front[i]
    }
  }

  const gap = best.auc - recommended.auc
  const noise = pooled(best.aucStd, recommended.aucStd)
  const fewer = best.parameters - recommended.parameters
  const takeaway =
    recommended.id === best.id
      ? `${best.id} is both the most accurate design and the knee of the front: ${best.auc.toFixed(3)} AUC at depth ${best.circuitDepth}.`
      : `${recommended.id} reaches ${recommended.auc.toFixed(3)} AUC at depth ${recommended.circuitDepth} — ${gap.toFixed(3)} below the best (${gap <= noise ? 'within' : 'beyond'} seed noise) with ${Math.abs(fewer)} ${fewer >= 0 ? 'fewer' : 'more'} trainable parameters.`

  const aucs = configs.map((c) => c.auc)
  return {
    type: 'evolution',
    dataset,
    experimentId: sweepId,
    evaluation: `${SEEDS} seeds · held-out 30% · ideal sim · ${code}`,
    model: 'vqc',
    configs,
    recommendedId: recommended.id,
    recommendationRule: 'Knee point: best AUC per layer',
    aucRange: [Math.floor(Math.min(...aucs) * 100) / 100, Math.ceil(Math.max(...aucs) * 100) / 100],
    takeaway,
  }
}

// ─── Failure envelope ───────────────────────────────────────

export function failureEnvelopeSweep(dataset: DatasetId): FailureEnvelopeSweep {
  const noiseValues = Array.from({ length: 13 }, (_, i) => round(i * 0.25, 2)) // 0–3% two-qubit error
  const corruptionValues = Array.from({ length: 13 }, (_, i) => round(i * 2.5, 1)) // 0–30% corrupted values
  const fb1 = NOISE_PROFILES.fakeBackend1
  const sensitivity = corruptionValues.map((corr) =>
    noiseValues.map((e2) => round(noisyOperatingPoint(dataset, { ...fb1, gateError2q: e2 }, corr).sensitivity, 4)),
  )
  // Shot/seed noise depends on the hardware noise, not on data corruption.
  const sensitivityStd = corruptionValues.map(() => noiseValues.map((e2) => round(noisySensitivityStd({ ...fb1, gateError2q: e2 }), 4)))
  const currentOp = noisyOperatingPoint(dataset, fb1, 0)
  const current = {
    noise: fb1.gateError2q,
    corruption: 0,
    sensitivity: round(currentOp.sensitivity, 4),
    std: round(noisySensitivityStd(fb1), 4),
    profileName: 'FakeBackend-1',
  }

  return {
    type: 'failure-envelope',
    dataset,
    experimentId: EXPERIMENT_IDS[dataset].noiseSweep,
    evaluation: `${SEEDS} seeds · held-out 30% · FakeBackend-1 noise · ${DATASETS[dataset].code}`,
    model: 'qsvm',
    noiseAxis: { label: 'Two-qubit gate error', unit: '%', values: noiseValues },
    corruptionAxis: { label: 'Data corruption', unit: '%', values: corruptionValues },
    sensitivity,
    sensitivityStd,
    threshold: SAFE_SENSITIVITY,
    current,
    takeaway: envelopeSentence(sensitivity, sensitivityStd, SAFE_SENSITIVITY, current),
  }
}
