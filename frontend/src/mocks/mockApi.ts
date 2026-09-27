/**
 * Mock implementation of the API. Same shapes as the FastAPI backend, with
 * simulated 300–800ms latency so loading states are visible.
 */
import type { Api, RequestOptions } from '@/api/types'
import { ApiError } from '@/api/errors'
import { DATASET_IDS } from '@/lib/domain'
import type { Experiment, SweepResponseMap, SweepType } from '@/types'
import { compare } from './data/compare'
import { crossModality } from './data/crossModality'
import { datasetDetail, datasetSummary, profileCsv } from './data/datasets'
import { EXPERIMENTS } from './data/experiments'
import { featureSchema } from './data/features'
import { HARDWARE_PROFILES, noiseRun } from './data/hardware'
import { FIRST_NEW_EXPERIMENT } from './data/ids'
import { explain, predict, trust } from './data/model'
import { overview, systemStatus, toSummary } from './data/overview'
import { patientReport } from './data/report'
import { evolutionSweep, failureEnvelopeSweep, scalabilitySweep, smallDataSweep } from './data/sweeps'
import { trainExperiment, trainResponse } from './data/train'
import { APP_VERSION } from '@/config'

const LATENCY_MIN = 300
const LATENCY_MAX = 800

/** Resolve after a random 300–800ms delay; rejects with AbortError if aborted. */
function respond<T>(produce: () => T, opts?: RequestOptions, latency?: number): Promise<T> {
  const ms = latency ?? LATENCY_MIN + Math.random() * (LATENCY_MAX - LATENCY_MIN)
  return new Promise<T>((resolve, reject) => {
    const signal = opts?.signal
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      try {
        // Deep-copy so callers can't mutate the mock's source data.
        resolve(structuredClone(produce()))
      } catch (error) {
        reject(error)
      }
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

// ─── Session state (experiments created by train / re-run) ──

const registry: Experiment[] = [...EXPERIMENTS]
let nextId = FIRST_NEW_EXPERIMENT

/** Current time as ISO-8601 in IST, matching the fixtures. */
function nowIst(): string {
  const ist = new Date(Date.now() + 5.5 * 3600_000)
  return `${ist.toISOString().slice(0, 19)}+05:30`
}

function newExperimentId(): string {
  const id = `EXP-${nextId}`
  nextId += 1
  return id
}

function findExperiment(id: string): Experiment {
  const found = registry.find((e) => e.id === id)
  if (!found) throw new ApiError(404, `Experiment ${id} not found`)
  return found
}

const SWEEPS: { [K in SweepType]: (dataset: 'wdbc' | 'heart') => SweepResponseMap[K] } = {
  'small-data': smallDataSweep,
  scalability: scalabilitySweep,
  evolution: evolutionSweep,
  'failure-envelope': failureEnvelopeSweep,
}

export const mockApi: Api = {
  health: (opts) => respond(() => ({ status: 'ok' as const, version: APP_VERSION, mock: true }), opts, 120),

  getOverview: (dataset, opts) => respond(() => overview(dataset, registry), opts),
  getStatus: (dataset, opts) => respond(() => systemStatus(dataset, registry), opts),

  listDatasets: (opts) => respond(() => DATASET_IDS.map(datasetSummary), opts),
  getDataset: (dataset, opts) => respond(() => datasetDetail(dataset), opts),
  getFeatureSchema: (dataset, opts) => respond(() => featureSchema(dataset), opts),
  uploadDataset: async (file, opts) => {
    const text = await file.text()
    return respond(() => {
      try {
        return profileCsv(file.name, text)
      } catch (error) {
        throw new ApiError(422, error instanceof Error ? error.message : 'Could not read the file.')
      }
    }, opts)
  },

  train: (req, opts) =>
    respond(() => {
      if (req.models.length === 0) throw new ApiError(422, 'Select at least one model.')
      const id = newExperimentId()
      const timestamp = nowIst()
      registry.unshift(trainExperiment(req, id, timestamp))
      return trainResponse(req, `JOB-${id.slice(4)}`, id, timestamp)
    }, opts),

  listExperiments: (params, opts) =>
    respond(() => {
      const list = registry
        .filter((e) => !params?.dataset || e.dataset === params.dataset)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .map(toSummary)
      return params?.limit ? list.slice(0, params.limit) : list
    }, opts),
  getExperiment: (id, opts) => respond(() => findExperiment(id), opts),
  rerunExperiment: (id, opts) =>
    respond(() => {
      const source = findExperiment(id)
      const copy: Experiment = {
        ...structuredClone(source),
        id: newExperimentId(),
        timestamp: nowIst(),
        notes: `Re-run of ${source.id}.`,
      }
      registry.unshift(copy)
      return copy
    }, opts),

  compare: (dataset, opts) => respond(() => compare(dataset), opts),
  getSweep: <T extends SweepType>(type: T, dataset: 'wdbc' | 'heart', opts?: RequestOptions) =>
    respond(() => SWEEPS[type](dataset), opts),

  getHardwareProfiles: (opts) => respond(() => HARDWARE_PROFILES, opts),
  runNoise: (req, opts) => respond(() => noiseRun(req), opts),

  predict: (req, opts) => respond(() => predict(req.dataset, req.input, req.threshold), opts),
  getTrust: (dataset, opts) => respond(() => trust(dataset), opts),
  explain: (req, opts) => respond(() => explain(req.dataset, req.input), opts),

  getCrossModality: (dataset, opts) => respond(() => crossModality(dataset), opts),
  getReport: (req, opts) => respond(() => patientReport(req.dataset, req.input, nowIst()), opts),
}
