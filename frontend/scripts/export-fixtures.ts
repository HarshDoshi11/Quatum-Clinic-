/**
 * Writes the frontend mock data to backend/app/fixtures/*.json so the FastAPI
 * stub serves byte-for-byte the same shapes and numbers.
 * Run: npm run export:fixtures
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DATASET_IDS } from '../src/lib/domain'
import type { DatasetId, SweepType, TrainRequest } from '../src/types'
import { compare } from '../src/mocks/data/compare'
import { crossModality } from '../src/mocks/data/crossModality'
import { datasetDetail, datasetSummary } from '../src/mocks/data/datasets'
import { EXPERIMENTS, circuitSearchChild } from '../src/mocks/data/experiments'
import { featureSchema } from '../src/mocks/data/features'
import { HARDWARE_PROFILES, noiseRun } from '../src/mocks/data/hardware'
import { explain, predict, trust } from '../src/mocks/data/model'
import { overview, systemStatus } from '../src/mocks/data/overview'
import { patientReport } from '../src/mocks/data/report'
import { evolutionSweep, failureEnvelopeSweep, scalabilitySweep, smallDataSweep } from '../src/mocks/data/sweeps'
import { trainResponse } from '../src/mocks/data/train'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', '..', 'backend', 'app', 'fixtures')
mkdirSync(out, { recursive: true })

const perDataset = <T>(build: (d: DatasetId) => T): Record<DatasetId, T> =>
  Object.fromEntries(DATASET_IDS.map((d) => [d, build(d)])) as Record<DatasetId, T>

const GENERATED_AT = '2026-09-27T14:40:00+05:30'

const defaultTrain = (dataset: DatasetId): TrainRequest => ({
  dataset,
  models: ['vqc', 'qsvm', 'logreg', 'svm', 'rf', 'xgboost'],
  qubits: 4,
  encoding: 'angle',
  circuitDepth: 2,
  seeds: 5,
})

const sweepBuilders: Record<SweepType, (d: DatasetId) => unknown> = {
  'small-data': smallDataSweep,
  scalability: scalabilitySweep,
  evolution: evolutionSweep,
  'failure-envelope': failureEnvelopeSweep,
}

const fixtures: Record<string, unknown> = {
  overview: perDataset((d) => overview(d, EXPERIMENTS)),
  status: perDataset((d) => systemStatus(d, EXPERIMENTS)),
  datasets: DATASET_IDS.map(datasetSummary),
  dataset_detail: perDataset(datasetDetail),
  schema: perDataset(featureSchema),
  experiments: EXPERIMENTS,
  // Circuit-search designs (EXP-2040.C07 …): resolvable by ID, never listed.
  experiment_children: DATASET_IDS.flatMap((d) => evolutionSweep(d).configs.map((c) => circuitSearchChild(c.experimentId, (x) => evolutionSweep(x).configs))),
  train: perDataset((d) => trainResponse(defaultTrain(d), 'JOB-2049', 'EXP-2049', GENERATED_AT)),
  compare: perDataset(compare),
  sweeps: Object.fromEntries(Object.entries(sweepBuilders).map(([type, build]) => [type, perDataset(build)])),
  noise_profiles: HARDWARE_PROFILES,
  noise_run: perDataset((d) =>
    Object.fromEntries(HARDWARE_PROFILES.map((p) => [p.id, noiseRun({ dataset: d, profileId: p.id, noise: p.noise })])),
  ),
  predict: perDataset((d) => ({
    sample: predict(d, featureSchema(d).samplePatient),
    unusual: predict(d, featureSchema(d).unusualPatient),
  })),
  trust: perDataset(trust),
  explain: perDataset((d) => explain(d, featureSchema(d).samplePatient)),
  cross_modality: perDataset(crossModality),
  report: perDataset((d) => ({
    sample: patientReport(d, featureSchema(d).samplePatient, GENERATED_AT),
    unusual: patientReport(d, featureSchema(d).unusualPatient, GENERATED_AT),
  })),
}

for (const [name, data] of Object.entries(fixtures)) {
  writeFileSync(join(out, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`)
}
console.log(`Wrote ${Object.keys(fixtures).length} fixtures to ${out}`)
