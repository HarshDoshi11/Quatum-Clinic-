/** Advantage Observatory benchmark: every number comes from the results store. */
import { DATASETS, MODEL_ORDER, MODELS } from '../../lib/domain'
import type { CompareResponse, ComparisonRow, DatasetId, ResourcePoint, SeedPoint } from '../../types'
import { SEEDS } from './canon'
import { EXPERIMENT_IDS, runIdFor } from './ids'
import { DEFAULT_BACKEND, bestModel, referenceConfig, referenceResult, result } from './results'
import { evolutionSweep } from './sweeps'

/** Combined 1-std noise of two independent estimates. */
export const pooledStd = (a: number, b: number): number => Math.sqrt(a ** 2 + b ** 2)

export function compare(dataset: DatasetId): CompareResponse {
  const ids = EXPERIMENT_IDS[dataset]
  const code = DATASETS[dataset].code

  const rows: ComparisonRow[] = MODEL_ORDER.map((model) => {
    const r = referenceResult(dataset, model)
    return {
      model,
      family: MODELS[model].family,
      configKey: r.key,
      backend: r.config.backend,
      experimentId: runIdFor(dataset, model),
      metrics: r.metrics,
      qubits: r.config.qubits,
      circuitDepth: r.config.circuitDepth,
    }
  })

  // Quantum resource scatter: VQC angle-encoded designs from the circuit search + QSVM at 4/6/8 qubits.
  const evo = evolutionSweep(dataset)
  const resources: ResourcePoint[] = [
    ...evo.configs
      .filter((c) => c.encoding === 'angle')
      .map((c) => ({ id: c.id, configKey: c.configKey, model: 'vqc' as const, qubits: c.qubits, circuitDepth: c.circuitDepth, auc: c.auc, aucStd: c.aucStd })),
    ...[4, 6, 8].map((q) => {
      const r = result(dataset, { ...referenceConfig(dataset, 'qsvm'), qubits: q, backend: DEFAULT_BACKEND.qsvm })
      return { id: `QSVM-${q}`, configKey: r.key, model: 'qsvm' as const, qubits: q, circuitDepth: r.config.circuitDepth ?? 2, auc: r.auc.mean, aucStd: r.auc.std }
    }),
  ]

  const baselines = MODEL_ORDER.filter((m) => MODELS[m].family === 'classical').map((model) => ({
    model,
    auc: referenceResult(dataset, model).auc.mean,
  }))

  const stability: SeedPoint[] = MODEL_ORDER.flatMap((model) =>
    referenceResult(dataset, model).seeds.map((auc, i) => ({ model, seed: i + 1, auc })),
  )

  // ─── Claims, worded by whether differences exceed seed noise ───
  const qm = bestModel(dataset, 'quantum')
  const cm = bestModel(dataset, 'classical')
  const q = referenceResult(dataset, qm).auc
  const c = referenceResult(dataset, cm).auc
  const delta = q.mean - c.mean
  const noise = pooledStd(q.std, c.std)
  const gap = Math.abs(delta).toFixed(3)
  const takeaway =
    Math.abs(delta) <= noise
      ? `${MODELS[qm].name} and ${MODELS[cm].name} differ by ${gap} AUC — within seed noise (±${noise.toFixed(3)}), so neither is clearly better.`
      : delta < 0
        ? `${MODELS[qm].name} trails ${MODELS[cm].name} by ${gap} AUC — more than the combined seed noise (±${noise.toFixed(3)}), so the classical lead is real on ${code}.`
        : `${MODELS[qm].name} leads ${MODELS[cm].name} by ${gap} AUC — more than the combined seed noise (±${noise.toFixed(3)}).`

  const bestRes = resources.reduce((a, b) => (b.auc > a.auc ? b : a), resources[0])
  const larger = resources.filter((r) => r.qubits * r.circuitDepth > bestRes.qubits * bestRes.circuitDepth)
  const largerBest = larger.reduce<ResourcePoint | null>((a, b) => (!a || b.auc > a.auc ? b : a), null)
  const resourcesTakeaway =
    `The best quantum design (${MODELS[bestRes.model].name}, ${bestRes.qubits} qubits × ${bestRes.circuitDepth} layers) reaches ${bestRes.auc.toFixed(3)} AUC` +
    (largerBest
      ? bestRes.auc - largerBest.auc <= pooledStd(bestRes.aucStd, largerBest.aucStd)
        ? `; the best larger circuit (${MODELS[largerBest.model].name}, ${largerBest.qubits} qubits × ${largerBest.circuitDepth} layers) scores within seed noise of it, so extra size buys nothing measurable.`
        : `; every larger circuit scores lower, beyond seed noise.`
      : '.')

  const stds = MODEL_ORDER.map((m) => ({ m, s: referenceResult(dataset, m).auc.std }))
  const lo = Math.min(...stds.map((x) => x.s))
  const hi = Math.max(...stds.map((x) => x.s))
  const steadiest = stds.find((x) => x.s === lo)?.m ?? cm
  const noisiest = stds.find((x) => x.s === hi)?.m ?? qm
  const stabilityTakeaway =
    hi - lo < 0.005
      ? `All models vary similarly between seeds (±${lo.toFixed(3)}–${hi.toFixed(3)} AUC).`
      : `${MODELS[steadiest].name} is the most stable (±${lo.toFixed(3)}); ${MODELS[noisiest].name} varies most between seeds (±${hi.toFixed(3)}).`

  return {
    dataset,
    experimentId: ids.benchmark,
    seeds: SEEDS,
    rows,
    resources,
    baselines,
    stability,
    takeaway,
    resourcesTakeaway,
    stabilityTakeaway,
    evaluation: `${SEEDS} seeds · held-out 30% · ${code}`,
  }
}

