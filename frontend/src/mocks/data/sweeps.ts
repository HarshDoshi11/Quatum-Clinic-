/** Sweep generators. Every curve ends on (or is capped by) the canonical anchors. */
import { MODELS, trainSize } from '../../lib/domain'
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
import { ANCHORS, NOISE_PROFILES, SAFE_SENSITIVITY, noisyOperatingPoint } from './canon'
import { EXPERIMENT_IDS } from './ids'
import { hashSeed, rng, round } from './math'

// ─── Small data ─────────────────────────────────────────────

/** Curvature per model: AUC(n) = final − k·(1/√n − 1/√N). Quantum kernels learn faster from few samples. */
const LEARNING_K: Partial<Record<ModelId, number>> = { qsvm: 0.35, vqc: 0.45, logreg: 0.55, xgboost: 0.75 }
const SMALL_DATA_MODELS: ModelId[] = ['qsvm', 'vqc', 'xgboost', 'logreg']

export function smallDataSweep(dataset: DatasetId): SmallDataSweep {
  const N = trainSize(dataset)
  const sizes = dataset === 'wdbc' ? [25, 50, 100, 200, N] : [25, 50, 100, 150, N]
  const series: LearningSeries[] = SMALL_DATA_MODELS.map((model) => {
    const a = ANCHORS[dataset][model]
    const k = LEARNING_K[model] ?? 0.5
    return {
      model,
      family: MODELS[model].family,
      points: sizes.map((n) => ({
        trainSize: n,
        label: n === N ? `All (${N})` : String(n),
        auc: {
          mean: round(a.auc - k * (1 / Math.sqrt(n) - 1 / Math.sqrt(N))),
          std: round(Math.min(0.06, a.aucStd * Math.sqrt(N / n))),
        },
      })),
    }
  })

  // Crossover: where the best classical curve overtakes the best quantum curve (analytic).
  const q = ANCHORS[dataset].qsvm
  const c = ANCHORS[dataset].xgboost
  const kq = LEARNING_K.qsvm ?? 0
  const kc = LEARNING_K.xgboost ?? 0
  // q.auc − kq·u = c.auc − kc·u, with u = 1/√n − 1/√N
  const u = (c.auc - q.auc) / (kc - kq)
  const invSqrtN = u + 1 / Math.sqrt(N)
  let crossover: Crossover | null = null
  if (u > 0 && invSqrtN > 0) {
    const n = 1 / invSqrtN ** 2
    if (n >= sizes[0] && n <= N) {
      crossover = { trainSize: Math.round(n), auc: round(q.auc - kq * u), quantumModel: 'qsvm', classicalModel: 'xgboost' }
    }
  }

  const small = series.find((s) => s.model === 'qsvm')?.points[0].auc.mean ?? 0
  const smallC = series.find((s) => s.model === 'xgboost')?.points[0].auc.mean ?? 0
  return {
    type: 'small-data',
    dataset,
    experimentId: EXPERIMENT_IDS[dataset].smallData,
    sizes,
    series,
    crossover,
    takeaway: crossover
      ? `With 25 training patients QSVM leads XGBoost by ${((small - smallC) * 100).toFixed(1)} AUC points; XGBoost overtakes at ~${crossover.trainSize} patients.`
      : 'Classical models lead at every training size.',
  }
}

// ─── Scalability (VQC) ──────────────────────────────────────

const SCALE_QUBITS = [4, 6, 8, 10, 12]
/** AUC offsets from the VQC anchor (best at 8 qubits). */
const SCALE_AUC_OFFSET = [-0.005, -0.002, 0, -0.001, -0.004]

export function scalabilitySweep(dataset: DatasetId): ScalabilitySweep {
  const a = ANCHORS[dataset].vqc
  const layers = a.circuitDepth ?? 3
  const points: ScalabilityPoint[] = SCALE_QUBITS.map((q, i) => {
    const twoQubitGates = layers * (q - 1) + Math.round(0.35 * q * q) // entanglers + SWAP routing overhead
    const gateCount = layers * 2 * q + q + twoQubitGates
    const circuitDepth = Math.round(layers * (4 + 0.9 * q) + 0.12 * q * q)
    const runtimeS = round(a.trainTimeS * (q / 8) ** 3.1, 0)
    return { qubits: q, circuitDepth, gateCount, twoQubitGates, runtimeS, auc: round(a.auc + SCALE_AUC_OFFSET[i]) }
  })

  // Bottleneck: first step where runtime grows ≥1.8× while AUC does not improve.
  let bottleneck: ScalabilitySweep['bottleneck'] = null
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    if (cur.runtimeS >= prev.runtimeS * 1.8 && cur.auc <= prev.auc) {
      bottleneck = {
        qubits: cur.qubits,
        explanation: `From ${prev.qubits} to ${cur.qubits} qubits runtime grows ×${(cur.runtimeS / prev.runtimeS).toFixed(1)} and two-qubit gates ×${(cur.twoQubitGates / prev.twoQubitGates).toFixed(1)}, while AUC falls by ${(prev.auc - cur.auc).toFixed(3)}.`,
      }
      break
    }
  }

  const peak = points.reduce((best, p) => (p.auc > best.auc ? p : best), points[0])

  return {
    type: 'scalability',
    dataset,
    experimentId: EXPERIMENT_IDS[dataset].scalability,
    model: 'vqc',
    points,
    bottleneck,
    takeaway: bottleneck
      ? `AUC peaks at ${peak.qubits} qubits; from ${bottleneck.qubits} qubits cost grows faster than accuracy.`
      : 'AUC keeps improving with qubits across the tested range.',
  }
}

// ─── Model evolution (circuit search) ───────────────────────

const SEARCH: { encoding: Encoding; qubits: number; depth: number; entanglement: Entanglement }[] = [
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
  { encoding: 'angle', qubits: 8, depth: 3, entanglement: 'linear' }, // best — matches the VQC anchor
  { encoding: 'angle', qubits: 8, depth: 4, entanglement: 'full' },
  { encoding: 'amplitude', qubits: 8, depth: 3, entanglement: 'linear' },
  { encoding: 'amplitude', qubits: 8, depth: 4, entanglement: 'full' },
]

export function evolutionSweep(dataset: DatasetId): EvolutionSweep {
  const best = ANCHORS[dataset].vqc
  const next = rng(hashSeed(`evolution-${dataset}`))
  const configs: CircuitConfig[] = SEARCH.map((c, i) => {
    const isBest = c.encoding === 'angle' && c.qubits === 8 && c.depth === 3 && c.entanglement === 'linear'
    // Depth helps up to 3 layers; amplitude encoding and full entanglement at depth 4 suffer trainability loss.
    const depthTerm = [0, -0.019, -0.009, -0.002, -0.004][c.depth]
    const qubitTerm = c.qubits === 4 ? -0.006 : c.qubits === 6 ? -0.003 : 0
    const encTerm = c.encoding === 'amplitude' ? -0.008 : 0
    const entTerm = c.entanglement === 'full' ? (c.depth >= 4 ? -0.007 : -0.002) : c.entanglement === 'circular' ? 0.001 : 0
    const jitter = (next() - 0.5) * 0.004
    const auc = isBest ? best.auc : Math.min(best.auc - 0.001, best.auc + depthTerm + qubitTerm + encTerm + entTerm + jitter)
    const perLayer = c.encoding === 'angle' ? 2 : 3
    return {
      id: `C${String(i + 1).padStart(2, '0')}`,
      encoding: c.encoding,
      qubits: c.qubits,
      circuitDepth: c.depth,
      entanglement: c.entanglement,
      parameters: c.qubits * c.depth * perLayer,
      auc: round(auc),
      trainTimeS: round(best.trainTimeS * (c.qubits / 8) ** 3.1 * (c.depth / 3), 0),
      pareto: false,
    }
  })

  // Pareto front: maximise AUC, minimise depth (ties broken by fewer qubits).
  const sorted = [...configs].sort((a, b) => a.circuitDepth - b.circuitDepth || b.auc - a.auc || a.qubits - b.qubits)
  let bestSoFar = -Infinity
  for (const c of sorted) {
    if (c.auc > bestSoFar) {
      c.pareto = true
      bestSoFar = c.auc
    }
  }

  // Recommended: the shallowest Pareto config within 0.0075 AUC of the best (knee of the front).
  const front = configs.filter((c) => c.pareto).sort((a, b) => a.circuitDepth - b.circuitDepth)
  const recommended = front.find((c) => c.auc >= best.auc - 0.0075) ?? front[front.length - 1]
  const bestConfig = front[front.length - 1]

  return {
    type: 'evolution',
    dataset,
    experimentId: EXPERIMENT_IDS[dataset].evolution,
    model: 'vqc',
    configs,
    recommendedId: recommended.id,
    takeaway:
      recommended.id === bestConfig.id
        ? `${recommended.id} is both the most accurate and the shallowest good design: ${recommended.auc.toFixed(3)} AUC at depth ${recommended.circuitDepth}.`
        : `${recommended.id} reaches ${recommended.auc.toFixed(3)} AUC at depth ${recommended.circuitDepth} — ${(best.auc - recommended.auc).toFixed(3)} below the best with ${bestConfig.parameters - recommended.parameters} fewer parameters.`,
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
  const current = noisyOperatingPoint(dataset, fb1, 0)
  const safeCells = sensitivity.flat().filter((s) => s >= SAFE_SENSITIVITY).length
  const total = noiseValues.length * corruptionValues.length

  return {
    type: 'failure-envelope',
    dataset,
    experimentId: EXPERIMENT_IDS[dataset].noiseSweep,
    model: 'qsvm',
    noiseAxis: { label: 'Two-qubit gate error', unit: '%', values: noiseValues },
    corruptionAxis: { label: 'Data corruption', unit: '%', values: corruptionValues },
    sensitivity,
    threshold: SAFE_SENSITIVITY,
    current: { noise: fb1.gateError2q, corruption: 0, sensitivity: round(current.sensitivity, 4), profileName: 'FakeBackend-1' },
    takeaway: `Only ${Math.round((safeCells / total) * 100)}% of the tested conditions keep sensitivity at or above ${Math.round(SAFE_SENSITIVITY * 100)}%; FakeBackend-1 already sits outside that region.`,
  }
}
