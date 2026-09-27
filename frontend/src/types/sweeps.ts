import type { Ansatz, ConfigKey, DatasetId, Encoding, Entanglement, ExperimentId, MeanStd, ModelFamily, ModelId } from './common'

export type SweepType = 'small-data' | 'scalability' | 'evolution' | 'failure-envelope'

interface SweepBase {
  dataset: DatasetId
  experimentId: ExperimentId
  takeaway: string
  /** Evaluation setting, e.g. "5 SEEDS · HELD-OUT 30% · IDEAL SIM · WDBC". */
  evaluation: string
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
  /** Only set when the ±1 std bands separate on both sides of the crossing. */
  crossover: Crossover | null
  /** Otherwise: first training size from which the gap is within the combined std. */
  gapClosesAt: number | null
}

// ─── Scalability ────────────────────────────────────────────

export interface ScalabilityPoint {
  configKey: ConfigKey
  qubits: number
  circuitDepth: number
  gateCount: number
  twoQubitGates: number
  runtimeS: number
  auc: number
  aucStd: number
}

export interface Bottleneck {
  qubits: number
  explanation: string
}

/** The rule used to place the bottleneck marker, shown under the chart. */
export interface BottleneckRule {
  runtimeGrowth: number
  text: string
}

export interface ScalabilitySweep extends SweepBase {
  type: 'scalability'
  model: ModelId
  points: ScalabilityPoint[]
  bottleneck: Bottleneck | null
  rule: BottleneckRule
}

// ─── Model evolution (circuit search) ───────────────────────

export interface CircuitConfig {
  id: string
  configKey: ConfigKey
  /** Experiment record for this single design (opens in the drawer). */
  experimentId: ExperimentId
  ansatz: Ansatz
  encoding: Encoding
  qubits: number
  circuitDepth: number
  entanglement: Entanglement
  parameters: number
  auc: number
  aucStd: number
  trainTimeS: number
  pareto: boolean
}

export interface EvolutionSweep extends SweepBase {
  type: 'evolution'
  model: ModelId
  configs: CircuitConfig[]
  recommendedId: string
  /** How the recommendation was chosen, e.g. "Knee point: best AUC per layer". */
  recommendationRule: string
  /** Zoomed y-range shown on the chart. */
  aucRange: [number, number]
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
  /** Seed/shot std for each cell, same shape. */
  sensitivityStd: number[][]
  threshold: number
  current: { noise: number; corruption: number; sensitivity: number; std: number; profileName: string }
}

export interface SweepResponseMap {
  'small-data': SmallDataSweep
  scalability: ScalabilitySweep
  evolution: EvolutionSweep
  'failure-envelope': FailureEnvelopeSweep
}

export type Sweep = SweepResponseMap[SweepType]
