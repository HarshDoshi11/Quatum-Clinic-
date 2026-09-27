import type {
  CompareResponse,
  CrossModalityResponse,
  DatasetDetail,
  DatasetId,
  DatasetSummary,
  Experiment,
  ExperimentId,
  ExperimentListParams,
  ExperimentSummary,
  ExplainRequest,
  ExplainResponse,
  FeatureSchema,
  HardwareProfile,
  Health,
  NoiseRunRequest,
  NoiseRunResponse,
  OverviewResponse,
  PatientReport,
  PredictRequest,
  PredictResponse,
  ReportRequest,
  SweepResponseMap,
  SweepType,
  SystemStatus,
  TrainRequest,
  TrainResponse,
  TrustResponse,
  UploadResponse,
} from '@/types'

export interface RequestOptions {
  signal?: AbortSignal
}

/**
 * The full client API. Implemented twice — mock (src/mocks) and HTTP (FastAPI) —
 * so pages never know which one they're talking to.
 */
export interface Api {
  health(opts?: RequestOptions): Promise<Health>

  getOverview(dataset: DatasetId, opts?: RequestOptions): Promise<OverviewResponse>
  getStatus(dataset: DatasetId, opts?: RequestOptions): Promise<SystemStatus>

  listDatasets(opts?: RequestOptions): Promise<DatasetSummary[]>
  getDataset(dataset: DatasetId, opts?: RequestOptions): Promise<DatasetDetail>
  getFeatureSchema(dataset: DatasetId, opts?: RequestOptions): Promise<FeatureSchema>
  uploadDataset(file: File, opts?: RequestOptions): Promise<UploadResponse>

  train(req: TrainRequest, opts?: RequestOptions): Promise<TrainResponse>
  listExperiments(params?: ExperimentListParams, opts?: RequestOptions): Promise<ExperimentSummary[]>
  getExperiment(id: ExperimentId, opts?: RequestOptions): Promise<Experiment>
  rerunExperiment(id: ExperimentId, opts?: RequestOptions): Promise<Experiment>

  compare(dataset: DatasetId, opts?: RequestOptions): Promise<CompareResponse>
  getSweep<T extends SweepType>(type: T, dataset: DatasetId, opts?: RequestOptions): Promise<SweepResponseMap[T]>

  getHardwareProfiles(opts?: RequestOptions): Promise<HardwareProfile[]>
  runNoise(req: NoiseRunRequest, opts?: RequestOptions): Promise<NoiseRunResponse>

  predict(req: PredictRequest, opts?: RequestOptions): Promise<PredictResponse>
  getTrust(dataset: DatasetId, opts?: RequestOptions): Promise<TrustResponse>
  explain(req: ExplainRequest, opts?: RequestOptions): Promise<ExplainResponse>

  getCrossModality(dataset: DatasetId, opts?: RequestOptions): Promise<CrossModalityResponse>
  getReport(req: ReportRequest, opts?: RequestOptions): Promise<PatientReport>
}
