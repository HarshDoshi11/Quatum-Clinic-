/** Hardware profiles, execution backends and the noise simulation (QSVM, 4 qubits). */
import { DATASETS } from '../../lib/domain'
import { noiseRunSentence, safetyStatus } from '../../lib/safety'
import type { BackendId, BackendStatus, HardwareProfile, HardwareProfileId, NoiseParams, NoiseRunRequest, NoiseRunResponse, OperatingPoint } from '../../types'
import { NOISE_PROFILES, SAFE_SENSITIVITY, SEEDS, noisyOperatingPoint, noisySensitivityStd } from './canon'
import { EXPERIMENT_IDS } from './ids'
import { round } from './math'
import { referenceConfig, result } from './results'

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

/** Preset profiles map onto results-store backends; custom settings have no store key. */
const PRESET_BACKEND: Partial<Record<HardwareProfileId, BackendId>> = {
  'ideal-sim': 'ideal-sim',
  'fake-backend-1': 'fake-backend-1',
  'fake-backend-2': 'fake-backend-2',
}

const sameNoise = (a: NoiseParams, b: NoiseParams) => (Object.keys(a) as (keyof NoiseParams)[]).every((k) => a[k] === b[k])

export function noiseRun(req: NoiseRunRequest): NoiseRunResponse {
  const { dataset, noise } = req
  const code = DATASETS[dataset].code
  const qsvm = referenceConfig(dataset, 'qsvm')

  const point = (backend: BackendId | null, n: NoiseParams): OperatingPoint => {
    const op = noisyOperatingPoint(dataset, n)
    // Preset backends read the store, so the Hardware Lab and every other page agree on the AUC.
    const stored = backend ? result(dataset, { ...qsvm, backend }) : null
    return {
      configKey: stored?.key ?? null,
      sensitivity: round(op.sensitivity, 4),
      specificity: round(op.specificity, 4),
      auc: stored ? stored.auc.mean : round(op.auc),
    }
  }

  const preset = PRESET_BACKEND[req.profileId]
  const profile = HARDWARE_PROFILES.find((p) => p.id === req.profileId)
  // A preset only counts as that backend if its parameters were not edited.
  const backend = preset && profile && sameNoise(profile.noise, noise) ? preset : null
  const reference = point('ideal-sim', NOISE_PROFILES.ideal)
  const res = point(backend, noise)
  const std = round(noisySensitivityStd(noise), 4)
  const status = safetyStatus(res.sensitivity, std, SAFE_SENSITIVITY)
  const where = backend && profile ? profile.name : 'these custom settings'

  const sweep = T2_SWEEP.map((t2Us) => {
    const n = { ...noise, t2Us }
    return { t2Us, sensitivity: round(noisyOperatingPoint(dataset, n).sensitivity, 4), std: round(noisySensitivityStd(n), 4) }
  })
  const safeFrom = sweep.findIndex((_, i) => sweep.slice(i).every((p) => safetyStatus(p.sensitivity, p.std, SAFE_SENSITIVITY) === 'safe'))
  const t = `${Math.round(SAFE_SENSITIVITY * 100)}%`
  const t2Takeaway =
    safeFrom === 0
      ? `Across ${T2_SWEEP[0]}–${T2_SWEEP[T2_SWEEP.length - 1]} µs, T2 alone never pushes sensitivity below the ${t} threshold with these settings.`
      : safeFrom > 0
        ? `With the other settings fixed, sensitivity stays safe beyond seed noise only when T2 ≥ ${sweep[safeFrom].t2Us} µs.`
        : `Even at T2 = ${T2_SWEEP[T2_SWEEP.length - 1]} µs sensitivity does not clear the ${t} threshold beyond noise — other noise sources dominate.`

  return {
    dataset,
    experimentId: EXPERIMENT_IDS[dataset].noiseSweep,
    model: 'qsvm',
    reference,
    result: res,
    sensitivityStd: std,
    threshold: SAFE_SENSITIVITY,
    safe: res.sensitivity >= SAFE_SENSITIVITY,
    status,
    takeaway: noiseRunSentence(where, reference.sensitivity, res.sensitivity, std, SAFE_SENSITIVITY),
    t2Takeaway,
    evaluation: `${SEEDS} seeds · held-out 30% · QSVM 4q · ${code}`,
    sensitivityVsT2: sweep,
  }
}
