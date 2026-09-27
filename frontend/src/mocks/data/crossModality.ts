/** Cross-modality study (Heart Disease only — WDBC has a single modality). */
import type { CrossModalityResponse, DatasetId, Modality, ModalityId } from '../../types'
import { referenceResult } from './results'
import { MODEL_FEATURES } from './features'
import { EXPERIMENT_IDS } from './ids'
import { round } from './math'

const MODALITY_META: { id: ModalityId; label: string; auc: number; std: number }[] = [
  { id: 'demographics', label: 'Demographics', auc: 0.712, std: 0.031 },
  { id: 'symptoms', label: 'Symptoms', auc: 0.781, std: 0.026 },
  { id: 'ecg', label: 'ECG', auc: 0.758, std: 0.028 },
  { id: 'exercise', label: 'Exercise Test', auc: 0.844, std: 0.021 },
  { id: 'labs', label: 'Blood Labs', auc: 0.694, std: 0.033 },
]

export function crossModality(dataset: DatasetId): CrossModalityResponse {
  const crossId = EXPERIMENT_IDS[dataset].crossModality
  if (dataset !== 'heart' || !crossId) {
    return {
      available: false,
      dataset,
      reason: 'Cross-modality analysis uses the Heart Disease dataset.',
      supportedDataset: 'heart',
    }
  }

  const modalities: Modality[] = MODALITY_META.map((m) => ({
    id: m.id,
    label: m.label,
    features: MODEL_FEATURES.heart.filter((f) => f.modality === m.id).map((f) => f.key),
    auc: { mean: m.auc, std: m.std },
  }))
  // All modalities together = the full-feature QSVM model.
  const combined = referenceResult('heart', 'qsvm').auc
  const best = modalities.reduce((a, b) => (b.auc.mean > a.auc.mean ? b : a))
  const gainPct = round(((combined.mean - best.auc.mean) / best.auc.mean) * 100, 1)

  return {
    available: true,
    dataset,
    experimentId: crossId,
    model: 'qsvm',
    modalities,
    combined,
    bestSingle: best.id,
    gainPct,
    takeaway: `Together: +${gainPct.toFixed(1)}% over the best single signal (${best.label}).`,
  }
}
