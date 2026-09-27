/** Training jobs: loss curve + per-model results, anchored to the benchmark. */
import { MODELS } from '../../lib/domain'
import type { Experiment, LossPoint, ModelId, TrainModelResult, TrainRequest, TrainResponse } from '../../types'
import { ANCHORS, modelMetrics } from './canon'
import { NOISE_FOR_BACKEND, SELECTED_FEATURES } from './experiments'
import { evolutionSweep } from './sweeps'
import { gaussian, hashSeed, rng, round } from './math'

const EPOCHS = 50

function quantumAuc(req: TrainRequest, model: ModelId): number {
  const anchor = ANCHORS[req.dataset][model]
  if (model === 'qsvm') {
    const penalty = { 4: 0, 6: 0.003, 8: 0.008 }[req.qubits]
    return round(anchor.auc - penalty - (req.encoding === 'amplitude' ? 0.006 : 0))
  }
  // VQC: look the configuration up in the circuit search; fall back to the closest one.
  const configs = evolutionSweep(req.dataset).configs
  const exact = configs.find((c) => c.encoding === req.encoding && c.qubits === req.qubits && c.circuitDepth === req.circuitDepth)
  if (exact) return exact.auc
  const close = configs
    .filter((c) => c.encoding === req.encoding)
    .sort((a, b) => Math.abs(a.qubits - req.qubits) + Math.abs(a.circuitDepth - req.circuitDepth) - (Math.abs(b.qubits - req.qubits) + Math.abs(b.circuitDepth - req.circuitDepth)))[0]
  return close?.auc ?? anchor.auc
}

function lossCurve(req: TrainRequest): LossPoint[] {
  const next = rng(hashSeed(`loss-${req.dataset}-${req.qubits}-${req.circuitDepth}-${req.encoding}`))
  const floor = 0.26 + (req.encoding === 'amplitude' ? 0.03 : 0) - 0.01 * (req.circuitDepth - 1)
  const tau = 9 + req.qubits * 0.8
  return Array.from({ length: EPOCHS }, (_, i) => {
    const epoch = i + 1
    const loss = floor + 0.43 * Math.exp(-epoch / tau) + 0.008 * gaussian(next)
    const valLoss = floor + 0.035 + 0.43 * Math.exp(-epoch / (tau * 1.1)) + 0.012 * gaussian(next)
    return { epoch, loss: round(loss, 4), valLoss: round(valLoss, 4) }
  })
}

export function trainResults(req: TrainRequest): TrainModelResult[] {
  return req.models.map((model) => {
    const info = MODELS[model]
    const anchor = ANCHORS[req.dataset][model]
    const mean = info.family === 'quantum' ? quantumAuc(req, model) : anchor.auc
    const std = req.seeds === 1 ? 0 : round(anchor.aucStd * Math.sqrt(5 / req.seeds))
    return { model, family: info.family, auc: { mean, std } }
  })
}

export function trainResponse(req: TrainRequest, jobId: string, experimentId: string, completedAt: string): TrainResponse {
  return {
    jobId,
    experimentId,
    epochs: EPOCHS,
    lossCurve: req.models.includes('vqc') ? lossCurve(req) : [],
    results: trainResults(req),
    completedAt,
  }
}

/** The experiment record a training job adds to the registry. */
export function trainExperiment(req: TrainRequest, id: string, timestamp: string): Experiment {
  const results = trainResults(req)
  const single = req.models.length === 1 ? req.models[0] : null
  const hasQuantum = req.models.some((m) => MODELS[m].family === 'quantum')
  const best = results.reduce((a, b) => (b.auc.mean > a.auc.mean ? b : a), results[0])
  return {
    id,
    kind: single ? 'run' : 'benchmark',
    title: single ? (hasQuantum ? `${MODELS[single].name} · ${req.qubits}q` : MODELS[single].name) : `Training · ${req.models.length} models`,
    dataset: req.dataset,
    model: single,
    family: single ? MODELS[single].family : null,
    backend: hasQuantum ? 'ideal-sim' : 'cpu',
    qubits: hasQuantum ? req.qubits : null,
    auc: best?.auc.mean ?? null,
    timestamp,
    status: 'complete',
    config: {
      dataset: req.dataset,
      models: req.models,
      features: SELECTED_FEATURES[req.dataset],
      pcaDims: hasQuantum ? req.qubits : null,
      encoding: hasQuantum ? req.encoding : null,
      qubits: hasQuantum ? req.qubits : null,
      circuitDepth: hasQuantum ? req.circuitDepth : null,
      entanglement: hasQuantum ? 'linear' : null,
      backend: hasQuantum ? 'ideal-sim' : 'cpu',
      noise: hasQuantum ? (NOISE_FOR_BACKEND['ideal-sim'] ?? null) : null,
      seed: 42,
      seeds: req.seeds,
    },
    metrics: single && best ? modelMetrics(req.dataset, single, best.auc.mean) : null,
    notes: 'Started from the Train page.',
  }
}
