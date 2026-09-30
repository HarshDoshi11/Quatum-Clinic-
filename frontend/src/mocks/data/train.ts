/** Training jobs: loss curve + per-model results, read from the results store. */
import { MODELS } from '../../lib/domain'
import type { Experiment, LossPoint, ModelId, TrainModelResult, TrainRequest, TrainResponse } from '../../types'
import { NOISE_FOR_BACKEND, SELECTED_FEATURES } from './experiments'
import { gaussian, hashSeed, rng, round } from './math'
import { DEFAULT_BACKEND, result, type ModelConfig } from './results'
import { SIMULATED } from './canon'

const EPOCHS = 50

/**
 * The configuration a Train request evaluates for one model. The circuit settings
 * apply to VQC; QSVM keeps its fixed ZZ feature map; each model runs on its
 * benchmark backend, so a default run matches the Observatory exactly.
 */
export function trainConfig(req: TrainRequest, model: ModelId): ModelConfig {
  if (MODELS[model].family === 'classical') {
    return { model, qubits: null, encoding: null, circuitDepth: null, entanglement: null, backend: 'cpu' }
  }
  return { model, qubits: req.qubits, encoding: req.encoding, circuitDepth: req.circuitDepth, entanglement: 'linear', backend: DEFAULT_BACKEND[model] }
}

function lossCurve(req: TrainRequest): LossPoint[] {
  const next = rng(hashSeed(`loss-${req.dataset}-${req.qubits}-${req.circuitDepth}-${req.encoding}`))
  const floor = 0.26 + (req.encoding === 'amplitude' ? 0.03 : 0) - 0.01 * (req.circuitDepth - 1) - (req.dataset === 'wdbc' ? 0.12 : 0)
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
    const r = result(req.dataset, trainConfig(req, model))
    return {
      model,
      family: MODELS[model].family,
      configKey: r.key,
      backend: r.config.backend,
      qubits: r.config.qubits,
      circuitDepth: r.config.circuitDepth,
      encoding: r.config.encoding,
      // Same config → same mean everywhere; a single-seed run just has no spread to report.
      auc: { mean: r.auc.mean, std: req.seeds === 1 ? 0 : r.auc.std },
    }
  })
}

export function trainResponse(req: TrainRequest, jobId: string, experimentId: string, completedAt: string): TrainResponse {
  return {
    source: SIMULATED,
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
  const singleResult = single ? result(req.dataset, trainConfig(req, single)) : null
  const backend = single ? (singleResult?.config.backend ?? 'cpu') : hasQuantum ? 'ideal-sim' : 'cpu'
  return {
    id,
    kind: single ? 'run' : 'benchmark',
    configKey: singleResult?.key ?? null,
    title: single ? (hasQuantum ? `${MODELS[single].name} · ${req.qubits}q` : MODELS[single].name) : `Training · ${req.models.length} models`,
    dataset: req.dataset,
    model: single,
    family: single ? MODELS[single].family : null,
    backend,
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
      backend,
      noise: hasQuantum ? (NOISE_FOR_BACKEND[backend] ?? null) : null,
      seed: 42,
      seeds: req.seeds,
    },
    metrics: singleResult ? singleResult.metrics : null,
    notes: 'Started from the Train page.',
  }
}
