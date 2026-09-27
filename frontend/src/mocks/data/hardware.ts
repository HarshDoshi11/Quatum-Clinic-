/** Hardware profiles, execution backends and the noise simulation. */
import type { BackendStatus, DatasetId, HardwareProfile, NoiseParams, NoiseRunRequest, NoiseRunResponse } from '../../types'
import { NOISE_PROFILES, SAFE_SENSITIVITY, noisyOperatingPoint, noisySensitivityStd } from './canon'
import { EXPERIMENT_IDS } from './ids'
import { round } from './math'

export const HARDWARE_PROFILES: HardwareProfile[] = [
  { id: 'ideal-sim', name: 'Ideal Sim', description: 'Noiseless statevector simulation.', qubits: 32, noise: NOISE_PROFILES.ideal },
  { id: 'fake-backend-1', name: 'FakeBackend-1', description: 'Calibration snapshot of a 27-qubit superconducting device.', qubits: 27, noise: NOISE_PROFILES.fakeBackend1 },
  { id: 'fake-backend-2', name: 'FakeBackend-2', description: 'Newer-generation 27-qubit device, lower two-qubit error.', qubits: 27, noise: NOISE_PROFILES.fakeBackend2 },
  { id: 'custom', name: 'Custom', description: 'Set each noise parameter by hand.', qubits: 27, noise: NOISE_PROFILES.fakeBackend2 },
]

export const BACKEND_STATUS: BackendStatus[] = [
  { id: 'ideal-sim', name: 'Ideal Sim', kind: 'simulator', qubits: 32, status: 'live', note: 'Statevector' },
  { id: 'noisy-sim', name: 'Noisy Sim', kind: 'simulator', qubits: 32, status: 'live', note: 'Generic noise model' },
  { id: 'fake-backend-1', name: 'FakeBackend-1', kind: 'fake-hardware', qubits: 27, status: 'live', note: 'Device calibration snapshot' },
  { id: 'ibm-qpu', name: 'IBM QPU', kind: 'hardware', qubits: 127, status: 'offline', note: 'Awaiting access token' },
]

const T2_SWEEP = [20, 40, 60, 80, 100, 150, 200, 300, 500]

export function noiseRun(req: NoiseRunRequest): NoiseRunResponse {
  const dataset: DatasetId = req.dataset
  const noise: NoiseParams = req.noise
  const reference = noisyOperatingPoint(dataset, NOISE_PROFILES.ideal)
  const result = noisyOperatingPoint(dataset, noise)
  return {
    dataset,
    experimentId: EXPERIMENT_IDS[dataset].noiseSweep,
    model: 'qsvm',
    reference: { sensitivity: round(reference.sensitivity, 4), specificity: round(reference.specificity, 4), auc: round(reference.auc) },
    result: { sensitivity: round(result.sensitivity, 4), specificity: round(result.specificity, 4), auc: round(result.auc) },
    sensitivityStd: round(noisySensitivityStd(noise), 4),
    threshold: SAFE_SENSITIVITY,
    safe: result.sensitivity >= SAFE_SENSITIVITY,
    sensitivityVsT2: T2_SWEEP.map((t2Us) => ({
      t2Us,
      sensitivity: round(noisyOperatingPoint(dataset, { ...noise, t2Us }).sensitivity, 4),
    })),
  }
}
