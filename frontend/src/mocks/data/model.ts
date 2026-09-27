/**
 * Mock scoring model: a calibrated linear model over standardised features.
 * Deterministic, so Predict, Explain, Trust and the Report always agree.
 */
import { testSize } from '../../lib/domain'
import type {
  CalibrationBin,
  DatasetId,
  ExplainResponse,
  FeatureContribution,
  PatientInput,
  PredictResponse,
  RiskBand,
  ThresholdPoint,
  TrustLevel,
  TrustResponse,
  TrustSignal,
} from '../../types'
import { ABSTAINED, ANCHORS, BEST_QUANTUM, dPrime, operatingPoint, prevalence, probToScore, sensSpecAtScore } from './canon'
import { EXPERIMENT_IDS } from './ids'
import { MODEL_FEATURES, SAMPLE_PATIENTS, SAMPLE_PROBABILITY, type ModelFeature } from './features'
import { gaussian, logit, rng, round, sigmoid } from './math'

const MODEL = BEST_QUANTUM

const zScore = (f: ModelFeature, x: number | null): number => (x === null ? 0 : (x - f.mean) / f.sd)

const rawScore = (dataset: DatasetId, input: PatientInput): number =>
  MODEL_FEATURES[dataset].reduce((sum, f) => sum + f.weight * zScore(f, input[f.key] ?? null), 0)

/** Scale weights so the average patient scores the base rate and the sample patient SAMPLE_PROBABILITY. */
const calibration = (dataset: DatasetId) => {
  const bias = logit(prevalence(dataset))
  const scale = (logit(SAMPLE_PROBABILITY) - bias) / rawScore(dataset, SAMPLE_PATIENTS[dataset])
  return { bias, scale }
}

const CALIBRATION = { wdbc: calibration('wdbc'), heart: calibration('heart') }

function scoreLogit(dataset: DatasetId, input: PatientInput): number {
  const { bias, scale } = CALIBRATION[dataset]
  return bias + scale * rawScore(dataset, input)
}

export const probability = (dataset: DatasetId, input: PatientInput): number => sigmoid(scoreLogit(dataset, input))

export const defaultThreshold = (dataset: DatasetId): number =>
  round(operatingPoint(dataset, ANCHORS[dataset][MODEL].auc).probThreshold, 2)

export function riskBand(p: number): RiskBand {
  return p < 0.3 ? 'low' : p < 0.6 ? 'moderate' : 'high'
}

/** Value with unit, trailing zeros trimmed: 0.2100 → "0.21", 143.5 → "143.5 µm²". */
const fmt = (f: ModelFeature, x: number): string => `${Number(x.toFixed(4))}${f.unit ? ` ${f.unit}` : ''}`

// ─── Input checks ───────────────────────────────────────────

interface InputCheck {
  missing: ModelFeature[]
  outOfRange: { feature: ModelFeature; value: number }[]
  maxAbsZ: number
  maxZFeature: ModelFeature | null
}

function checkInput(dataset: DatasetId, input: PatientInput): InputCheck {
  const check: InputCheck = { missing: [], outOfRange: [], maxAbsZ: 0, maxZFeature: null }
  for (const f of MODEL_FEATURES[dataset]) {
    const x = input[f.key] ?? null
    if (x === null || Number.isNaN(x)) {
      check.missing.push(f)
      continue
    }
    if (x < f.min || x > f.max) check.outOfRange.push({ feature: f, value: x })
    const z = Math.abs(zScore(f, x))
    if (z > check.maxAbsZ) {
      check.maxAbsZ = z
      check.maxZFeature = f
    }
  }
  return check
}

// ─── Per-prediction trust evidence ──────────────────────────

const levelOf = (value: number, strongBelow: number, partialBelow: number): TrustLevel =>
  value < strongBelow ? 'strong' : value < partialBelow ? 'partial' : 'weak'

function trustSignals(dataset: DatasetId, input: PatientInput, check: InputCheck, threshold: number): TrustSignal[] {
  const features = MODEL_FEATURES[dataset]
  const l = scoreLogit(dataset, input)
  const p = sigmoid(l)

  // Stability: spread across seeds.
  const sigma = ANCHORS[dataset][MODEL].aucStd * 8
  const [lo, hi] = [sigmoid(l - 1.96 * sigma), sigmoid(l + 1.96 * sigma)]
  const spread = hi - lo
  const crosses = lo < threshold && hi >= threshold

  // Input sensitivity: ±0.1 SD measurement error on each continuous feature.
  let maxDelta = 0
  let flips = false
  const flagged = p >= threshold
  for (const f of features) {
    const x = input[f.key] ?? null
    if (x === null || f.kind !== 'continuous') continue
    for (const dir of [-1, 1]) {
      const perturbed = { ...input, [f.key]: x + dir * 0.1 * f.sd }
      const q = probability(dataset, perturbed)
      maxDelta = Math.max(maxDelta, Math.abs(q - p))
      if (q >= threshold !== flagged) flips = true
    }
  }

  // Hardware sensitivity: FakeBackend-1 noise flattens the kernel, shrinking the logit.
  const pNoisy = sigmoid(l * 0.8)
  const hwDelta = Math.abs(pNoisy - p)
  const hwFlip = pNoisy >= threshold !== flagged

  // Calibration: local gap between predicted and observed on the test set.
  const bins = calibrationBins(dataset)
  const bin = bins.reduce((best, b) => (Math.abs(b.predicted - p) < Math.abs(best.predicted - p) ? b : best), bins[0])
  const gap = Math.abs(bin.observed - bin.predicted)

  const n = features.length
  const presentCount = n - check.missing.length
  // Outside the training range the model is extrapolating: behaviour checks can't vouch for it.
  const extrapolating = check.outOfRange.length > 0

  return [
    {
      id: 'stability',
      label: 'Prediction stability',
      level: extrapolating || crosses ? 'weak' : levelOf(spread, 0.08, 0.15),
      reason: extrapolating
        ? 'Seed agreement means little when the model is extrapolating.'
        : crosses
          ? `Seeds disagree on the side of the threshold (${Math.round(lo * 100)}–${Math.round(hi * 100)}%).`
          : `5 seeds agree within ±${(spread * 50).toFixed(1)} points.`,
    },
    {
      id: 'data-quality',
      label: 'Data quality',
      level: check.missing.length === 0 ? 'strong' : check.missing.length === 1 ? 'partial' : 'weak',
      reason:
        check.missing.length === 0
          ? `All ${n} inputs present and within valid ranges.`
          : `${presentCount} of ${n} inputs present; missing: ${check.missing.map((f) => f.label.toLowerCase()).join(', ')}.`,
    },
    {
      id: 'distribution-shift',
      label: 'Distribution shift (OOD)',
      level: check.outOfRange.length > 0 ? 'weak' : levelOf(check.maxAbsZ, 2.5, 3.5),
      reason:
        check.outOfRange.length > 0
          ? `${check.outOfRange.length} value${check.outOfRange.length > 1 ? 's' : ''} outside anything seen in training.`
          : check.maxAbsZ < 2.5
            ? 'Patient resembles the training population.'
            : `${check.maxZFeature?.label ?? 'One value'} is unusual (${check.maxAbsZ.toFixed(1)} SD from average).`,
    },
    {
      id: 'calibration',
      label: 'Calibration',
      level: extrapolating ? 'weak' : levelOf(gap, 0.05, 0.1),
      reason: extrapolating
        ? 'Calibration was only measured on patients within the training range.'
        : `At ~${Math.round(bin.predicted * 100)}% predicted, ${Math.round(bin.observed * 100)}% of similar test patients were positive.`,
    },
    {
      id: 'input-sensitivity',
      label: 'Input sensitivity',
      level: extrapolating || flips ? 'weak' : levelOf(maxDelta, 0.03, 0.06),
      reason: extrapolating
        ? 'Out-of-range inputs make the result unpredictable under small changes.'
        : flips
          ? 'A small measurement error could flip the decision.'
          : `Small measurement errors move the result by at most ${(maxDelta * 100).toFixed(1)} points.`,
    },
    {
      id: 'hardware-sensitivity',
      label: 'Hardware sensitivity',
      level: extrapolating || hwFlip ? 'weak' : levelOf(hwDelta, 0.03, 0.08),
      reason: extrapolating
        ? 'Hardware robustness was only tested within the training range.'
        : hwFlip
          ? 'Real-hardware noise would flip this decision.'
        : `On FakeBackend-1 noise the result moves ${(hwDelta * 100).toFixed(1)} points; decision unchanged.`,
    },
  ]
}

// ─── Public builders ────────────────────────────────────────

let predictionCounter = 0

export function predict(dataset: DatasetId, input: PatientInput, thresholdIn?: number): PredictResponse {
  const threshold = thresholdIn ?? defaultThreshold(dataset)
  const check = checkInput(dataset, input)
  const trust = trustSignals(dataset, input, check, threshold)

  const abstainReasons: string[] = [
    ...check.outOfRange.map(
      ({ feature, value }) =>
        `${feature.label} ${fmt(feature, value)} is outside the training range (${fmt(feature, feature.min)} – ${fmt(feature, feature.max)}).`,
    ),
    ...check.missing.map((f) => `${f.label} is missing.`),
  ]
  const abstain = check.outOfRange.length > 0 || check.missing.length >= 3 || (check.missing.length > 0 && check.maxAbsZ > 3)

  predictionCounter += 1
  const base = {
    predictionId: `PRD-${dataset.toUpperCase()}-${String(predictionCounter).padStart(4, '0')}`,
    dataset,
    model: MODEL,
    experimentId: EXPERIMENT_IDS[dataset].qsvmRun,
    threshold,
    trust,
  }

  if (abstain) {
    return { ...base, decision: 'abstain', probability: null, interval: null, riskBand: null, flagged: null, abstainReasons }
  }

  const l = scoreLogit(dataset, input)
  const sigma = ANCHORS[dataset][MODEL].aucStd * 8
  const p = sigmoid(l)
  return {
    ...base,
    decision: 'predict',
    probability: round(p),
    interval: [round(sigmoid(l - 1.96 * sigma)), round(sigmoid(l + 1.96 * sigma))],
    riskBand: riskBand(p),
    flagged: p >= threshold,
    abstainReasons: [],
  }
}

export function explain(dataset: DatasetId, input: PatientInput): ExplainResponse {
  const { bias, scale } = CALIBRATION[dataset]
  const contributions: FeatureContribution[] = MODEL_FEATURES[dataset]
    .map((f) => {
      const value = input[f.key] ?? null
      const contribution = round(scale * f.weight * zScore(f, value), 4)
      return {
        feature: f.key,
        label: f.label,
        value,
        contribution,
        direction: contribution >= 0 ? ('increases' as const) : ('decreases' as const),
        immutable: f.immutable,
      }
    })
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
  return {
    dataset,
    model: MODEL,
    baseProbability: round(sigmoid(bias)),
    probability: round(probability(dataset, input)),
    contributions,
  }
}

// ─── Model-level trust (test set) ───────────────────────────

/** The model is slightly over-confident (logits 8% too large), typical of kernel methods before recalibration. */
const OVERCONFIDENCE = 1.08

interface TestCase {
  p: number
  /** True posterior probability of this case. */
  truth: number
}

/** Deterministic synthetic test set drawn from the binormal model. */
function testSet(dataset: DatasetId): TestCase[] {
  const auc = ANCHORS[dataset][MODEL].auc
  const d = dPrime(auc)
  const n = testSize(dataset)
  const nPos = Math.round(n * prevalence(dataset))
  const next = rng(dataset === 'wdbc' ? 569 : 303)
  const pi = prevalence(dataset)
  const cases: TestCase[] = []
  for (let i = 0; i < n; i++) {
    const s = (i < nPos ? d : 0) + gaussian(next)
    const trueLogit = d * (s - d / 2) + logit(pi)
    cases.push({ p: sigmoid(OVERCONFIDENCE * trueLogit), truth: sigmoid(trueLogit) })
  }
  return cases
}

const binCache = new Map<DatasetId, CalibrationBin[]>()

export function calibrationBins(dataset: DatasetId): CalibrationBin[] {
  const cached = binCache.get(dataset)
  if (cached) return cached
  const cases = testSet(dataset)
  const bins: CalibrationBin[] = []
  for (let b = 0; b < 10; b++) {
    const inBin = cases.filter((c) => c.p >= b / 10 && (c.p < (b + 1) / 10 || (b === 9 && c.p <= 1)))
    if (inBin.length === 0) continue
    bins.push({
      predicted: round(inBin.reduce((s, c) => s + c.p, 0) / inBin.length),
      observed: round(inBin.reduce((s, c) => s + c.truth, 0) / inBin.length),
      count: inBin.length,
    })
  }
  binCache.set(dataset, bins)
  return bins
}

export function trust(dataset: DatasetId): TrustResponse {
  const auc = ANCHORS[dataset][MODEL].auc
  const bins = calibrationBins(dataset)
  const total = bins.reduce((s, b) => s + b.count, 0)
  const ece = bins.reduce((s, b) => s + (b.count / total) * Math.abs(b.observed - b.predicted), 0)

  const thresholds = Array.from({ length: 19 }, (_, i) => round((i + 1) * 0.05, 2))
  const thresholdCurve: ThresholdPoint[] = thresholds.map((t) => {
    const { sensitivity, specificity } = sensSpecAtScore(auc, probToScore(dataset, auc, t))
    return { threshold: t, sensitivity: round(sensitivity), specificity: round(specificity) }
  })

  const n = testSize(dataset)
  return {
    dataset,
    model: MODEL,
    experimentId: EXPERIMENT_IDS[dataset].qsvmRun,
    calibration: bins,
    ece: round(ece),
    thresholdCurve,
    defaultThreshold: defaultThreshold(dataset),
    testPatients: n,
    abstained: ABSTAINED[dataset],
    abstainRate: round(ABSTAINED[dataset] / n, 4),
    highConfidenceMisses: 0,
  }
}
