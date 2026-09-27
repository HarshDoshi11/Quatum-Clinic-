/**
 * Asserts that the mock data agrees with the numbers in the product spec and
 * with itself across endpoints. Run: npm run check:mocks
 */
import { MODELS } from '../src/lib/domain'
import { compare } from '../src/mocks/data/compare'
import { crossModality } from '../src/mocks/data/crossModality'
import { EXPERIMENTS } from '../src/mocks/data/experiments'
import { NOISE_PROFILES } from '../src/mocks/data/canon'
import { featureSchema } from '../src/mocks/data/features'
import { noiseRun } from '../src/mocks/data/hardware'
import { predict, trust } from '../src/mocks/data/model'
import { overview } from '../src/mocks/data/overview'
import { patientReport } from '../src/mocks/data/report'
import { evolutionSweep, failureEnvelopeSweep, scalabilitySweep, smallDataSweep } from '../src/mocks/data/sweeps'

let failures = 0
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? '  ok ' : ' FAIL'}  ${label}${ok ? '' : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`}`)
}
const time = (iso: string) => iso.slice(11, 16)

console.log('\nWDBC — headline numbers')
const ov = overview('wdbc', EXPERIMENTS)
check('best overall = XGBoost 0.921', [ov.status.bestOverall.model, ov.status.bestOverall.auc.mean], ['xgboost', 0.921])
check('best quantum = QSVM 0.914 ±0.012', [ov.status.bestQuantum.model, ov.status.bestQuantum.auc], ['qsvm', { mean: 0.914, std: 0.012 }])
check('last experiment = EXP-2048', ov.status.lastExperiment.id, 'EXP-2048')

console.log('\nWDBC — recent experiments')
check(
  'recent list',
  ov.recentExperiments.map((e) => [e.id, MODELS[e.model ?? 'vqc'].name, e.qubits, e.backend, e.auc, time(e.timestamp)]),
  [
    ['EXP-2048', 'VQC', 4, 'fake-backend-1', 0.902, '14:32'],
    ['EXP-2047', 'QSVM', 4, 'noisy-sim', 0.914, '13:48'],
    ['EXP-2046', 'XGBoost', null, 'cpu', 0.921, '12:16'],
    ['EXP-2045', 'VQC', 8, 'ideal-sim', 0.909, '11:02'],
    ['EXP-2044', 'LogReg', null, 'cpu', 0.907, '09:41'],
  ],
)

console.log('\nWDBC — findings')
check('findings values', ov.findings.map((f) => f.value), ['Δ −0.007 AUC', '1.2%', '4.1%'])
check('advantage summary', ov.findings[0].summary, 'QSVM 0.914 vs XGBoost 0.921 — within noise across 5 seeds.')

console.log('\nCross-page agreement')
const cmp = compare('wdbc')
const aucOf = (m: string) => cmp.rows.find((r) => r.model === m)?.metrics.auc.mean
check('compare: QSVM / XGBoost / VQC AUC', [aucOf('qsvm'), aucOf('xgboost'), aucOf('vqc')], [0.914, 0.921, 0.909])
check('compare: best AUC row is XGBoost', cmp.rows.reduce((a, b) => (b.metrics.auc.mean > a.metrics.auc.mean ? b : a)).model, 'xgboost')
check('evolution: best config AUC = VQC best 0.909', Math.max(...evolutionSweep('wdbc').configs.map((c) => c.auc)), 0.909)
check('scalability: peak AUC = VQC best 0.909', Math.max(...scalabilitySweep('wdbc').points.map((p) => p.auc)), 0.909)
const sd = smallDataSweep('wdbc')
check('small-data: curves end on anchors', sd.series.map((s) => [s.model, s.points[s.points.length - 1].auc.mean]), [['qsvm', 0.914], ['vqc', 0.909], ['xgboost', 0.921], ['logreg', 0.907]])
const qsvmSens = cmp.rows.find((r) => r.model === 'qsvm')?.metrics.sensitivity.mean
const noisySim = noiseRun({ dataset: 'wdbc', profileId: 'custom', noise: NOISE_PROFILES.noisySim })
check('hardware: Noisy Sim sensitivity = benchmark QSVM sensitivity', Math.round(noisySim.result.sensitivity * 1000) / 1000, qsvmSens)
const fb1 = noiseRun({ dataset: 'wdbc', profileId: 'fake-backend-1', noise: NOISE_PROFILES.fakeBackend1 })
check('hardware: ideal → FakeBackend-1 sensitivity', [(fb1.reference.sensitivity * 100).toFixed(1), (fb1.result.sensitivity * 100).toFixed(1)], ['89.4', '84.2'])
check('hardware: ideal QSVM stays below XGBoost', fb1.reference.auc < 0.921, true)
const at12 = noiseRun({ dataset: 'wdbc', profileId: 'custom', noise: { ...NOISE_PROFILES.fakeBackend1, gateError2q: 1.2 } })
check('hardware: sensitivity at 1.2% 2Q error = 85.0%', (at12.result.sensitivity * 100).toFixed(1), '85.0')
const env = failureEnvelopeSweep('wdbc')
check('failure envelope: "you are here" = FakeBackend-1 result', env.current.sensitivity, fb1.result.sensitivity)
const tr = trust('wdbc')
check('trust: 7 of 171 abstained = 4.1%, 0 high-confidence misses', [tr.abstained, tr.testPatients, (tr.abstainRate * 100).toFixed(1), tr.highConfidenceMisses], [7, 171, '4.1', 0])

console.log('\nPredict / report')
const schema = featureSchema('wdbc')
const sample = predict('wdbc', schema.samplePatient)
check('sample patient: 0.82, high risk, predicted', [sample.probability, sample.riskBand, sample.decision], [0.82, 'high', 'predict'])
const unusual = predict('wdbc', schema.unusualPatient)
check('unusual patient: abstains', unusual.decision, 'abstain')
const heartSample = predict('heart', featureSchema('heart').samplePatient)
check('heart sample patient: 0.82', heartSample.probability, 0.82)
check('report agrees with prediction', patientReport('wdbc', schema.samplePatient, '2026-09-27T14:40:00+05:30').result.probability, sample.probability)

console.log('\nHeart — cross-modality')
const cm = crossModality('heart')
check('combined = heart QSVM AUC, gain +6.2%', cm.available ? [cm.combined.mean, cm.gainPct, cm.bestSingle] : null, [0.896, 6.2, 'exercise'])
check('WDBC: cross-modality unavailable', crossModality('wdbc').available, false)

console.log('\nRegistry')
const ids = new Set(EXPERIMENTS.map((e) => e.id))
check('experiment IDs unique', ids.size, EXPERIMENTS.length)
const referenced = [
  ...ov.findings.map((f) => f.experimentId),
  cmp.experimentId,
  ...cmp.rows.map((r) => r.experimentId),
  sd.experimentId,
  env.experimentId,
  tr.experimentId,
  cm.available ? cm.experimentId : 'EXP-2036',
  ...overview('heart', EXPERIMENTS).findings.map((f) => f.experimentId),
]
check('every referenced experiment ID resolves', referenced.filter((id) => !ids.has(id)), [])
const sortedByTime = [...EXPERIMENTS].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).map((e) => e.id)
check('IDs increase with time', sortedByTime, [...sortedByTime].sort())

console.log(failures === 0 ? '\nAll mock data checks passed.\n' : `\n${failures} check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)
