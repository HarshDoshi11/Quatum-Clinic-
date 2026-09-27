/** HTTP implementation of the API, talking to the FastAPI backend at API_URL. */
import { API_URL } from '@/config'
import type { DatasetId } from '@/types'
import { ApiError } from './errors'
import type { Api, RequestOptions } from './types'

type Query = Record<string, string | number | undefined>

async function request<T>(method: 'GET' | 'POST', path: string, opts: RequestOptions & { query?: Query; body?: unknown } = {}): Promise<T> {
  const url = new URL(path.replace(/^\//, ''), API_URL.endsWith('/') ? API_URL : `${API_URL}/`)
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }
  const isForm = opts.body instanceof FormData
  const res = await fetch(url, {
    method,
    signal: opts.signal,
    headers: opts.body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
  })
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const data: unknown = await res.json()
      if (data && typeof data === 'object' && 'detail' in data && typeof data.detail === 'string') message = data.detail
    } catch {
      // Non-JSON error body — keep the status line.
    }
    throw new ApiError(res.status, message)
  }
  return (await res.json()) as T
}

const get = <T>(path: string, opts?: RequestOptions, query?: Query) => request<T>('GET', path, { ...opts, query })
const post = <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('POST', path, { ...opts, body })
const ds = (dataset: DatasetId): Query => ({ dataset })

export const httpApi: Api = {
  health: (opts) => get('/health', opts),

  getOverview: (dataset, opts) => get('/overview', opts, ds(dataset)),
  getStatus: (dataset, opts) => get('/status', opts, ds(dataset)),

  listDatasets: (opts) => get('/datasets', opts),
  getDataset: (dataset, opts) => get(`/datasets/${dataset}`, opts),
  getFeatureSchema: (dataset, opts) => get(`/datasets/${dataset}/schema`, opts),
  uploadDataset: (file, opts) => {
    const form = new FormData()
    form.append('file', file)
    return post('/upload', form, opts)
  },

  train: (req, opts) => post('/train', req, opts),
  listExperiments: (params, opts) => get('/experiments', opts, { dataset: params?.dataset, limit: params?.limit }),
  getExperiment: (id, opts) => get(`/experiments/${encodeURIComponent(id)}`, opts),
  rerunExperiment: (id, opts) => post(`/experiments/${encodeURIComponent(id)}/rerun`, {}, opts),

  compare: (dataset, opts) => get('/compare', opts, ds(dataset)),
  getSweep: (type, dataset, opts) => get(`/sweeps/${type}`, opts, ds(dataset)),

  getHardwareProfiles: (opts) => get('/noise/profiles', opts),
  runNoise: (req, opts) => post('/noise/run', req, opts),

  predict: (req, opts) => post('/predict', req, opts),
  getTrust: (dataset, opts) => get('/trust', opts, ds(dataset)),
  explain: (req, opts) => post('/explain', req, opts),

  getCrossModality: (dataset, opts) => get('/cross-modality', opts, ds(dataset)),
  getReport: (req, opts) => post('/report', req, opts),
}
