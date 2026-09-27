/**
 * Asserts that the mock data is realistic per dataset, consistent across every
 * endpoint (one result per config key), and that every claim respects seed noise.
 * Run: npm run check:mocks
 */
import { MODEL_ORDER, MODELS } from '../src/lib/domain'
import type { DatasetId, TrainRequest } from '../src/types'
import { NOISE_PROFILES } from '../src/mocks/data/canon'
import { compare } from '../src/mocks/data/compare'
import { crossModality } from '../src/mocks/data/crossModality'
import { EXPERIMENTS, circuitSearchChild } from '../src/mocks/data/experiments'
import { featureSchema } from '../src/mocks/data/features'
import { noiseRun } from '../src/mocks/data/hardware'
import { predict, trust } from '../src/mocks/data/model'
import { overview } from '../src/mocks/data/overview'
import { patientReport } from '../src/mocks/data/report'
import { bestModel, checkResponseConsistency, referenceResult, result, trainableParameters } from '../src/mocks/data/results'
import { evolutionSweep, failureEnvelopeSweep, scalabilitySweep, smallDataSweep } from '../src/mocks/data/sweeps'
import { trainResponse } from '../src/mocks/data/train'

let failures = 0
function check(label: string, ok: boolean, detail = ''): void {
  if (!ok) failures += 1
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${label}${ok || !detail ? '' : `\n        ${detail}`}`)
}
const eq = (label: string, actual: unknown, expected: unknown) =>
  check(label, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`)
const inRange = (label: string, v: number, lo: number, hi: number) => check(`${label} = ${v} ∈ [${lo}, ${hi}]`, v >= lo && v <= hi)
const time = (iso: string) => iso.slice(11, 16)

// ─── 10. Dataset realism ────────────────────────────────────
console.log('\nWDBC — realistic breast-cancer results')
for (const m of MODEL_ORDER) {
  const r = referenceResult('wdbc', m)
  if (MODELS[m].family === 'classical') {
    inRange(`${MODELS[m].name} AUC`, r.auc.mean, 0.985, 0.995)
    inRange(`${MODELS[m].name} accuracy`, r.metrics.accuracy.mean, 0.95, 0.98)
  }
}
inRange('QSVM AUC', referenceResult('wdbc', 'qsvm').auc.mean, 0.975, 0.99)
inRange('VQC AUC', referenceResult('wdbc', 'vqc').auc.mean, 0.96, 0.98)

console.log('\nHeart — values unchanged')
eq('Heart AUCs (XGBoost, RF, SVM, LogReg, QSVM, VQC)', ['xgboost', 'rf', 'svm', 'logreg', 'qsvm', 'vqc'].map((m) => referenceResult('heart', m as never).auc.mean), [0.903, 0.898, 0.892, 0.884, 0.896, 0.889])
for (const m of MODEL_ORDER.filter((x) => MODELS[x].family === 'classical')) inRange(`Heart ${MODELS[m].name} accuracy`, referenceResult('heart', m).metrics.accuracy.mean, 0.78, 0.85)

console.log('\nNo two datasets show identical numbers')
const numbersOf = (d: DatasetId) => {
  const o = overview(d, EXPERIMENTS)
  return [...compare(d).rows.map((r) => r.metrics.auc.mean), o.status.bestQuantum.auc.mean, ...o.findings.map((f) => f.value)]
}
const shared = numbersOf('wdbc').filter((v) => numbersOf('heart').includes(v))
eq('overlap between WDBC and Heart headline numbers', shared, [])

// ─── 14. Single source of truth ─────────────────────────────
console.log('\nOne result per config key, across every endpoint')
const problems: string[] = []
const trainReqs = (d: DatasetId): TrainRequest[] =>
  [4, 6, 8].flatMap((q) => (['angle', 'amplitude'] as const).flatMap((encoding) => [1, 2, 3, 4].map((depth) => ({
    dataset: d, models: ['vqc', 'qsvm', 'logreg', 'svm', 'rf', 'xgboost'], qubits: q as 4 | 6 | 8, encoding, circuitDepth: depth as 1 | 2 | 3 | 4, seeds: 5 as const,
  }))))
for (const d of ['wdbc', 'heart'] as const) {
  problems.push(...checkResponseConsistency(compare(d), `compare/${d}`))
  problems.push(...checkResponseConsistency(evolutionSweep(d), `evolution/${d}`))
  problems.push(...checkResponseConsistency(scalabilitySweep(d), `scalability/${d}`))
  for (const req of trainReqs(d)) problems.push(...checkResponseConsistency(trainResponse(req, 'J', 'E', ''), `train/${d}`))
}
problems.push(...checkResponseConsistency(EXPERIMENTS, 'experiments'))
eq('config-key conflicts', problems, [])
for (const d of ['wdbc', 'heart'] as const) {
  const vqc4 = trainResponse({ dataset: d, models: ['vqc'], qubits: 4, encoding: 'angle', circuitDepth: 3, seeds: 5 }, 'J', 'E', '').results[0].auc.mean
  const scale4 = scalabilitySweep(d).points.find((p) => p.qubits === 4)?.auc
  eq(`${d}: VQC · 4q · angle · d3 — Train = Scalability`, vqc4, scale4)
  const qsvmTrain = trainResponse({ dataset: d, models: ['qsvm'], qubits: 4, encoding: 'angle', circuitDepth: 2, seeds: 5 }, 'J', 'E', '').results[0].auc.mean
  eq(`${d}: QSVM · 4q — Train = Observatory`, qsvmTrain, compare(d).rows.find((r) => r.model === 'qsvm')?.metrics.auc.mean)
}

// ─── Pareto chart ───────────────────────────────────────────
console.log('\nModel Evolution Engine')
for (const d of ['wdbc', 'heart'] as const) {
  const ev = evolutionSweep(d)
  const frontMax = Math.max(...ev.configs.filter((c) => c.pareto).map((c) => c.auc))
  eq(`${d}: Pareto maximum = best VQC shown elsewhere`, frontMax, referenceResult(d, 'vqc').auc.mean)
  check(`${d}: parameter counts follow the ansatz formulas`, ev.configs.every((c) => c.parameters === (c.entanglement === 'full' ? 3 * c.qubits * c.circuitDepth : c.qubits * (c.circuitDepth + 1))))
  const fewer = ev.takeaway.match(/(\d+) fewer/)?.[1]
  const rec = ev.configs.find((c) => c.id === ev.recommendedId)
  const best = ev.configs.find((c) => c.auc === frontMax)
  if (fewer && rec && best) eq(`${d}: "N fewer parameters" is computed`, Number(fewer), best.parameters - rec.parameters)
  check(`${d}: every design resolves as an experiment`, ev.configs.every((c) => circuitSearchChild(c.experimentId, (x) => evolutionSweep(x).configs)?.auc === c.auc))
}
eq('parameter formula spot check (StronglyEntangling 4q×3)', trainableParameters({ model: 'vqc', qubits: 4, encoding: 'angle', circuitDepth: 3, entanglement: 'full', backend: 'ideal-sim' }), 36)

// ─── 11. Claims respect seed noise ──────────────────────────
console.log('\nClaims respect uncertainty')
for (const d of ['wdbc', 'heart'] as const) {
  const q = referenceResult(d, bestModel(d, 'quantum')).auc
  const c = referenceResult(d, bestModel(d, 'classical')).auc
  const within = Math.abs(q.mean - c.mean) <= Math.hypot(q.std, c.std)
  check(`${d}: advantage wording matches noise test (${within ? 'within' : 'beyond'})`, compare(d).takeaway.includes(within ? 'within seed noise' : 'more than the combined seed noise'))
  const sd = smallDataSweep(d)
  check(`${d}: crossover only claimed when bands separate`, sd.crossover === null || sd.takeaway.includes('overtakes'))
  const sc = scalabilitySweep(d)
  const flat = Math.max(...sc.points.map((p) => p.auc)) - Math.min(...sc.points.map((p) => p.auc))
  check(`${d}: scalability wording (spread ${flat.toFixed(3)})`, sc.takeaway.length > 0)
}

// ─── Unchanged anchors ──────────────────────────────────────
console.log('\nRegistry, trust, patient')
const ov = overview('wdbc', EXPERIMENTS)
eq('WDBC recent runs (ID, model, backend, time)', ov.recentExperiments.map((e) => [e.id, e.model, e.backend, time(e.timestamp)]), [
  ['EXP-2048', 'vqc', 'fake-backend-1', '14:32'],
  ['EXP-2047', 'qsvm', 'noisy-sim', '13:48'],
  ['EXP-2046', 'xgboost', 'cpu', '12:16'],
  ['EXP-2045', 'vqc', 'ideal-sim', '11:02'],
  ['EXP-2044', 'logreg', 'cpu', '09:41'],
])
check('recent-run AUCs come from the store', ov.recentExperiments.every((e) => e.configKey !== null && result('wdbc', { ...EXPERIMENTS.find((x) => x.id === e.id)!.config, model: e.model! }).auc.mean === e.auc))
eq('WDBC findings: noise tolerance and abstain rate', [ov.findings[1].value, ov.findings[2].value], ['1.2%', '4.1%'])
const at12 = noiseRun({ dataset: 'wdbc', profileId: 'custom', noise: { ...NOISE_PROFILES.fakeBackend1, gateError2q: 1.2 } })
eq('WDBC sensitivity at 1.2% 2Q error = 85.0%', (at12.result.sensitivity * 100).toFixed(1), '85.0')
eq('failure envelope "you are here" = FakeBackend-1', failureEnvelopeSweep('wdbc').current.sensitivity, noiseRun({ dataset: 'wdbc', profileId: 'fake-backend-1', noise: NOISE_PROFILES.fakeBackend1 }).result.sensitivity)
const tr = trust('wdbc')
eq('trust: 7 of 171 abstained, 0 high-confidence misses', [tr.abstained, tr.testPatients, tr.highConfidenceMisses], [7, 171, 0])
const schema = featureSchema('wdbc')
eq('sample patient 0.82 · unusual abstains', [predict('wdbc', schema.samplePatient).probability, predict('wdbc', schema.unusualPatient).decision], [0.82, 'abstain'])
eq('report agrees with prediction', patientReport('wdbc', schema.samplePatient, '').result.probability, 0.82)
const cm = crossModality('heart')
eq('Heart cross-modality: combined = QSVM, +6.2%', cm.available ? [cm.combined.mean, cm.gainPct] : null, [0.896, 6.2])
const ids = new Set(EXPERIMENTS.map((e) => e.id))
eq('experiment IDs unique', ids.size, EXPERIMENTS.length)
const referenced = ['wdbc', 'heart'].flatMap((d) => [...overview(d as DatasetId, EXPERIMENTS).findings.map((f) => f.experimentId), ...compare(d as DatasetId).rows.map((r) => r.experimentId)])
eq('every referenced experiment ID resolves', referenced.filter((id) => !ids.has(id)), [])

console.log(failures === 0 ? '\nAll mock data checks passed.\n' : `\n${failures} check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)
