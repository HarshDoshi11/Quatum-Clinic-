/**
 * Cross-modality study: the benchmark QSVM trained on each kind of test alone,
 * vs all of them together. Which kinds of test a dataset has is declared on its
 * config (DATASETS[d].modalities); the analysis runs when there are two or more.
 * Every AUC comes from the results store, so each subset has one config key.
 */
import { BACKENDS, DATASETS, DATASET_IDS, MODELS } from '../../lib/domain'
import { formatDelta } from '../../lib/format'
import type { CombinedVerdict, CrossModalityResponse, DatasetId, Modality, ModalityResult } from '../../types'
import { BEST_QUANTUM, SEEDS } from './canon'
import { MODEL_FEATURES } from './features'
import { EXPERIMENT_IDS } from './ids'
import { referenceConfig, result } from './results'
import { round } from './math'

const MODEL = BEST_QUANTUM

export const supportsCrossModality = (dataset: DatasetId): boolean => DATASETS[dataset].modalities.length >= 2

/** Combined vs best single, judged against the combined seed std √(σ₁² + σ₂²). */
export function combinedVerdict(difference: number, noise: number): CombinedVerdict {
  if (difference > noise) return 'gain'
  if (difference < -noise) return 'loss'
  return 'within-noise'
}

function takeaway(verdict: CombinedVerdict, gainPct: number, best: string): string {
  const gain = `${formatDelta(gainPct, 1)}%`
  switch (verdict) {
    case 'gain':
      return `Together: ${gain} over the best single signal (${best}), beyond seed noise.`
    case 'within-noise':
      return `Together: ${gain} against the best single signal (${best}), within seed noise.`
    case 'loss':
      return `Together: ${gain} against the best single signal (${best}); combining loses beyond seed noise.`
  }
}

export function crossModality(dataset: DatasetId): CrossModalityResponse {
  const meta = DATASETS[dataset]
  if (!supportsCrossModality(dataset)) {
    const supportedDatasets = DATASET_IDS.filter(supportsCrossModality)
    const only = meta.modalities[0]
    return {
      available: false,
      dataset,
      reason: `Cross-modality analysis uses the ${supportedDatasets.map((d) => DATASETS[d].name).join(' or ')} dataset.`,
      detail: only
        ? `${meta.name} (${meta.code}) has one kind of test, ${only.label.toLowerCase()}, so there is nothing to combine.`
        : `${meta.name} (${meta.code}) doesn’t declare which kind of test each feature comes from.`,
      supportedDatasets,
    }
  }

  const reference = referenceConfig(dataset, MODEL)
  const features = MODEL_FEATURES[dataset]
  const modalities: Modality[] = meta.modalities.map((m) => {
    const r = result(dataset, { ...reference, modality: m.id })
    return { id: m.id, label: m.label, configKey: r.key, features: features.filter((f) => f.modality === m.id).map((f) => f.key), auc: r.auc }
  })
  // All modalities together = the benchmark model on every feature (same key as every other page).
  const all = result(dataset, reference)
  const combined: ModalityResult = { configKey: all.key, label: 'All combined', features: features.map((f) => f.key), auc: all.auc }

  const best = modalities.reduce((a, b) => (b.auc.mean > a.auc.mean ? b : a))
  const difference = round(combined.auc.mean - best.auc.mean, 4)
  const noise = round(Math.sqrt(combined.auc.std ** 2 + best.auc.std ** 2), 4)
  const verdict = combinedVerdict(difference, noise)
  const gainPct = round((difference / best.auc.mean) * 100, 1)

  return {
    available: true,
    dataset,
    experimentId: EXPERIMENT_IDS[dataset].crossModality ?? EXPERIMENT_IDS[dataset].benchmark,
    model: MODEL,
    backend: reference.backend,
    qubits: reference.qubits ?? 0,
    evaluation: `${MODELS[MODEL].name} ${reference.qubits}q · ${BACKENDS[reference.backend].name.toLowerCase()} · ${SEEDS} seeds · held-out 30% · ${meta.code}`,
    modalities,
    combined,
    bestSingle: best.id,
    gainPct,
    difference,
    noise,
    verdict,
    takeaway: takeaway(verdict, gainPct, best.label),
  }
}
