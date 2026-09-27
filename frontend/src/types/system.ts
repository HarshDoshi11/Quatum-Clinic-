import type { BackendId, DatasetId, ExperimentId, ISODateTime, MeanStd, ModelId } from './common'
import type { ExperimentSummary } from './experiment'

export interface Health {
  status: 'ok'
  version: string
  mock: boolean
}

export interface ActiveBackend {
  id: BackendId
  /** "SIM" */
  kind: string
  /** "IDEAL" */
  mode: string
  qubits: number
}

export interface SystemStatus {
  dataset: DatasetId
  activeBackend: ActiveBackend
  bestQuantum: { model: ModelId; auc: MeanStd; experimentId: ExperimentId; qubits: number }
  bestOverall: { model: ModelId; auc: MeanStd; experimentId: ExperimentId }
  lastExperiment: { id: ExperimentId; timestamp: ISODateTime }
  updatedAt: ISODateTime
}

export type BackendKind = 'simulator' | 'fake-hardware' | 'hardware'

export interface BackendStatus {
  id: BackendId
  name: string
  kind: BackendKind
  qubits: number
  status: 'live' | 'offline'
  note: string
}

export type FindingId = 'advantage' | 'noise' | 'trust'

export interface Finding {
  id: FindingId
  label: string
  /** Pre-formatted headline value, e.g. "Δ −0.007 AUC", "1.2%". */
  value: string
  summary: string
  link: { label: string; path: string }
  experimentId: ExperimentId
}

export interface OverviewResponse {
  dataset: DatasetId
  status: SystemStatus
  findings: Finding[]
  backends: BackendStatus[]
  recentExperiments: ExperimentSummary[]
}
