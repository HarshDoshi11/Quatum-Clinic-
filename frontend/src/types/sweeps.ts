import type { DatasetId, Encoding, Entanglement, ExperimentId, MeanStd, ModelFamily, ModelId } from './common'

export type SweepType = 'small-data' | 'scalability' | 'evolution' | 'failure-envelope'

interface SweepBase {
  dataset: DatasetId
  experimentId: ExperimentId
  takeaway: string
}

// ─── Small-data ─────────────────────────────────────────────

export interface LearningPoint {
  trainSize: number
  /** "25", …, "All (398)". */
  label: string
  auc: MeanStd
}

export interface LearningSeries {
  model: ModelId
  family: ModelFamily
  points: LearningPoint[]
}

export interface Crossover {
  /** Interpolated training size where the classical curve overtakes the quantum one. */
  trainSize: number
  auc: number
  quantumModel: ModelId
  classicalModel: ModelId
}

export interface SmallDataSweep extends SweepBase {
  type: 'small-data'
  sizes: number[]
  series: LearningSeries[]
  crossover: Crossover | null
}

// ─── Scalability ────────────────────────────────────────────

export interface ScalabilityPoint {
  qubits: number
  circuitDepth: number
  gateCount: number
  twoQubitGates: number
  runtimeS: number
  auc: number
}

export interface Bottleneck {
  qubits: number
  explanation: string
}

export interface ScalabilitySweep extends SweepBase {
  type: 'scalability'
  model: ModelId
  points: ScalabilityPoint[]
  bottleneck: Bottleneck | null
}

// ─── Model evolution (circuit search) ───────────────────────

export interface CircuitConfig {
  id: string
  encoding: Encoding
  qubits: number
  circuitDepth: number
  entanglement: Entanglement
  parameters: number
  auc: number
  trainTimeS: number
  pareto: boolean
}

export interface EvolutionSweep extends SweepBase {
  type: 'evolution'
  model: ModelId
  configs: CircuitConfig[]
  recommendedId: string
}

// ─── Failure envelope ───────────────────────────────────────

export interface EnvelopeAxis {
  label: string
  unit: string
  values: number[]
}

export interface FailureEnvelopeSweep extends SweepBase {
  type: 'failure-envelope'
  model: ModelId
  noiseAxis: EnvelopeAxis
  corruptionAxis: EnvelopeAxis
  /** sensitivity[corruptionIndex][noiseIndex], fraction 0–1. */
  sensitivity: number[][]
  threshold: number
  current: { noise: number; corruption: number; sensitivity: number; profileName: string }
}

export interface SweepResponseMap {
  'small-data': SmallDataSweep
  scalability: ScalabilitySweep
  evolution: EvolutionSweep
  'failure-envelope': FailureEnvelopeSweep
}

export type Sweep = SweepResponseMap[SweepType]
