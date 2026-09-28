/**
 * Mock scoring model: a calibrated linear model over the PCA components that
 * the training pipeline produces (see pipeline.ts). Every input — a new
 * patient or a what-if change — goes through the same preprocessing and PCA.
 * Deterministic, so Predict, Explain, Trust and the Report always agree.
 */
import { BACKENDS, DATASETS, MODELS, testSize } from '../../lib/domain'
import { formatPercent } from '../../lib/format'
import { operatingSentence } from '../../lib/safety'
import type {
  CalibrationBin,
  DatasetId,
  EncodedComponent,
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
import { ABSTAINED, BEST_QUANTUM, SAFE_SENSITIVITY, SEEDS, dPrime, operatingPoint, prevalence, probToScore, sensSpecAtScore } from './canon'
import { EXPERIMENT_IDS } from './ids'
import { referenceResult, result } from './results'
import { MODEL_FEATURES, SAMPLE_PATIENTS, SAMPLE_PROBABILITY, type ModelFeature } from './features'
import { gaussian, logit, rng, round, sigmoid } from './math'
import { PCA, PCA_MEANING, preprocess } from './pipeline'

const MODEL = BEST_QUANTUM

const zScore = (f: ModelFeature, x: number | null): number => (x === null ? 0 : (x - f.mean) / f.sd)

/** Model score before calibration: the component weights applied to the patient's PCA components. */
const rawScore = (dataset: DatasetId, input: PatientInput): number =>
  preprocess(dataset, input).components.reduce((sum, c, k) => sum + PCA[dataset].componentWeights[k] * c, 0)

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
  round(operatingPoint(dataset, referenceResult(dataset, MODEL).auc.mean).probThreshold, 2)

/** "QSVM 4q · noisy sim" — the deployed model's benchmark configuration. */
function modelSetting(dataset: DatasetId): string {
  const { config } = referenceResult(dataset, MODEL)
  return `${MODELS[MODEL].name} ${config.qubits}q · ${BACKENDS[config.backend].name.toLowerCase()}`
}

/**
 * How much FakeBackend-1 noise shrinks the model's separation (d′), read from the
 * results store: the same FakeBackend-1 result the Hardware Lab shows.
 */
export function hardwareSeparationScale(dataset: DatasetId): number {
  const ref = referenceResult(dataset, MODEL)
  const fb1 = result(dataset, { ...ref.config, backend: 'fake-backend-1' })
  return dPrime(fb1.auc.mean) / dPrime(ref.auc.mean)
}

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
  const sigma = referenceResult(dataset, MODEL).auc.std * 8
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

  // Hardware sensitivity: FakeBackend-1 noise flattens the kernel, pulling the score toward the base rate.
  const bias = CALIBRATION[dataset].bias
  const pNoisy = sigmoid(bias + (l - bias) * hardwareSeparationScale(dataset))
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
          ? 'A small error in one entered value could flip the decision.'
          : `Small errors in the entered values move the result by at most ${(maxDelta * 100).toFixed(1)} points.`,
    },
    {
      id: 'hardware-sensitivity',
      label: 'Hardware sensitivity',
      // Weak only if noise would flip the decision; a large move that keeps the decision is partial.
      level: extrapolating || hwFlip ? 'weak' : hwDelta < 0.03 ? 'strong' : 'partial',
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
    evaluation: `${modelSetting(dataset)} · same pipeline as training · ${DATASETS[dataset].code}`,
    threshold,
    trust,
  }

  if (abstain) {
    return { ...base, decision: 'abstain', probability: null, interval: null, riskBand: null, flagged: null, abstainReasons }
  }

  const l = scoreLogit(dataset, input)
  const sigma = referenceResult(dataset, MODEL).auc.std * 8
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

/** "Concave points" → "concave points"; acronyms such as "ST depression" keep their capitals. */
const inSentence = (label: string) => (/^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label)
const listOf = (labels: string[]) => (labels.length < 2 ? labels.join('') : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`)

/** Computed reading of the contributions: the strongest pushes up and the strongest pull down. */
function explainTakeaway(contributions: FeatureContribution[]): string {
  const ups = contributions.filter((c) => c.contribution > 0).slice(0, 2)
  const downs = contributions.filter((c) => c.contribution < 0).slice(0, 1)
  const name = (c: FeatureContribution, i: number) => (i === 0 ? c.label : inSentence(c.label))
  if (ups.length === 0) return `Every input pulls the estimate down; ${inSentence(downs[0]?.label ?? 'none')} the most.`
  const up = `${listOf(ups.map(name))} push${ups.length === 1 ? 'es' : ''} the estimate up the most`
  return downs.length ? `${up}; ${inSentence(downs[0].label)} pulls it down the most.` : `${up}; nothing pulls it down.`
}

export function explain(dataset: DatasetId, input: PatientInput): ExplainResponse {
  const { bias, scale } = CALIBRATION[dataset]
  const pre = preprocess(dataset, input)
  const weights = PCA[dataset].featureWeights
  const contributions: FeatureContribution[] = pre.features
    .map(({ feature: f, raw, used, z, adjustment }, j) => {
      const contribution = round(scale * weights[j] * z, 4)
      return {
        feature: f.key,
        label: f.label,
        unit: f.unit,
        value: raw,
        used: round(used, 4),
        adjustment,
        contribution,
        direction: contribution >= 0 ? ('increases' as const) : ('decreases' as const),
        locked: f.locked,
      }
    })
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
  const encoding: EncodedComponent[] = pre.encoding.map((value, k) => ({ component: k + 1, label: PCA_MEANING[dataset][k].label, value }))
  return {
    dataset,
    model: MODEL,
    experimentId: EXPERIMENT_IDS[dataset].qsvmRun,
    evaluation: `${MODELS[MODEL].name} 4q · angle encoding · same pipeline as training · ${DATASETS[dataset].code}`,
    baseProbability: round(sigmoid(bias)),
    probability: round(probability(dataset, input)),
    contributions,
    encoding,
    takeaway: explainTakeaway(contributions),
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
  const auc = referenceResult(dataset, MODEL).auc.mean
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
    const observed = inBin.reduce((s, c) => s + c.truth, 0) / inBin.length
    bins.push({
      predicted: round(inBin.reduce((s, c) => s + c.p, 0) / inBin.length),
      observed: round(observed),
      // Spread of the observed rate across seeds ≈ its binomial std for this bin size.
      observedStd: round(Math.max(0.005, Math.sqrt((observed * (1 - observed)) / inBin.length)), 4),
      count: inBin.length,
    })
  }
  binCache.set(dataset, bins)
  return bins
}

/** Computed reading of the calibration curve: is the bias beyond the average seed spread? */
function calibrationTakeaway(bias: number, noise: number, ece: number): string {
  const e = `ECE ${formatPercent(ece)}`
  if (Math.abs(bias) <= noise) return `Predicted and observed rates agree within seed noise (${e}).`
  const pts = `${(Math.abs(bias) * 100).toFixed(1)} points`
  return bias > 0
    ? `The model is over-confident: its predictions sit ${pts} further from 50% than what happened, beyond seed noise (${e}).`
    : `The model is under-confident: its predictions sit ${pts} closer to 50% than what happened, beyond seed noise (${e}).`
}

/** Seed std of a rate p, scaled like binomial spread from the store's std at the operating point p0. */
const spreadAt = (p: number, p0: number, std0: number): number =>
  round(Math.max(0.002, (std0 * Math.sqrt(p * (1 - p))) / Math.sqrt(p0 * (1 - p0))), 4)

export function trust(dataset: DatasetId): TrustResponse {
  const ref = referenceResult(dataset, MODEL)
  const auc = ref.auc.mean
  const bins = calibrationBins(dataset)
  const total = bins.reduce((s, b) => s + b.count, 0)
  const weighted = (f: (b: CalibrationBin) => number) => bins.reduce((s, b) => s + (b.count / total) * f(b), 0)
  const ece = weighted((b) => Math.abs(b.observed - b.predicted))
  // Positive when predictions sit further from 50% than the observed rates (over-confidence).
  const bias = weighted((b) => Math.sign(b.predicted - 0.5) * (b.predicted - b.observed))
  const noise = weighted((b) => b.observedStd)

  // The default threshold is the store's operating point, so it shows the same numbers as every other page.
  const t0 = defaultThreshold(dataset)
  const { sensitivity: sens0, specificity: spec0 } = ref.metrics
  const thresholds = Array.from({ length: 99 }, (_, i) => round((i + 1) / 100, 2))
  const thresholdCurve: ThresholdPoint[] = thresholds.map((t) => {
    if (t === t0) return { threshold: t, sensitivity: sens0.mean, sensitivityStd: sens0.std, specificity: spec0.mean, specificityStd: spec0.std }
    const { sensitivity, specificity } = sensSpecAtScore(auc, probToScore(dataset, auc, t))
    return {
      threshold: t,
      sensitivity: round(sensitivity, 4),
      sensitivityStd: spreadAt(sensitivity, sens0.mean, sens0.std),
      specificity: round(specificity, 4),
      specificityStd: spreadAt(specificity, spec0.mean, spec0.std),
    }
  })
  const point = { sensitivity: sens0.mean, sensitivityStd: sens0.std, specificity: spec0.mean, specificityStd: spec0.std }

  const n = testSize(dataset)
  return {
    dataset,
    model: MODEL,
    experimentId: EXPERIMENT_IDS[dataset].qsvmRun,
    evaluation: `${modelSetting(dataset)} · ${SEEDS} seeds · held-out 30% · ${DATASETS[dataset].code}`,
    calibration: bins,
    ece: round(ece),
    calibrationBias: round(bias, 4),
    calibrationTakeaway: calibrationTakeaway(bias, noise, ece),
    thresholdCurve,
    operatingPoint: { configKey: ref.key, threshold: t0, auc, sensitivity: sens0, specificity: spec0 },
    thresholdTakeaway: operatingSentence(t0, point, SAFE_SENSITIVITY, true),
    safeSensitivity: SAFE_SENSITIVITY,
    defaultThreshold: t0,
    testPatients: n,
    abstained: ABSTAINED[dataset],
    abstainRate: round(ABSTAINED[dataset] / n, 4),
    highConfidenceMisses: 0,
  }
}
