/** Experiment IDs referenced across pages. IDs increase with time. */
import type { DatasetId, ExperimentId } from '../../types'

export interface DatasetExperimentIds {
  benchmark: ExperimentId
  smallData: ExperimentId
  scalability: ExperimentId
  evolution: ExperimentId
  noiseSweep: ExperimentId
  crossModality: ExperimentId | null
  qsvmRun: ExperimentId
  vqcIdealRun: ExperimentId
  vqcHardwareRun: ExperimentId
  xgboostRun: ExperimentId
  rfRun: ExperimentId
  svmRun: ExperimentId
  logregRun: ExperimentId
}

export const EXPERIMENT_IDS: Record<DatasetId, DatasetExperimentIds> = {
  heart: {
    svmRun: 'EXP-2024',
    rfRun: 'EXP-2025',
    logregRun: 'EXP-2026',
    xgboostRun: 'EXP-2027',
    vqcIdealRun: 'EXP-2028',
    qsvmRun: 'EXP-2029',
    vqcHardwareRun: 'EXP-2030',
    benchmark: 'EXP-2031',
    smallData: 'EXP-2032',
    scalability: 'EXP-2033',
    evolution: 'EXP-2034',
    noiseSweep: 'EXP-2035',
    crossModality: 'EXP-2036',
  },
  wdbc: {
    benchmark: 'EXP-2037',
    smallData: 'EXP-2038',
    scalability: 'EXP-2039',
    evolution: 'EXP-2040',
    noiseSweep: 'EXP-2041',
    crossModality: null,
    svmRun: 'EXP-2042',
    rfRun: 'EXP-2043',
    // The five most recent runs, as shown on the Overview.
    logregRun: 'EXP-2044',
    vqcIdealRun: 'EXP-2045',
    xgboostRun: 'EXP-2046',
    qsvmRun: 'EXP-2047',
    vqcHardwareRun: 'EXP-2048',
  },
}

/** Next ID handed out by train / re-run in the mock session. */
export const FIRST_NEW_EXPERIMENT = 2049
