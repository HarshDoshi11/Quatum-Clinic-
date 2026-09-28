import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { DatasetId, FeatureSchema, PatientInput } from '@/types'

/**
 * The patient currently being assessed, one per dataset. Predict & Trust sets it;
 * Explain and the Patient Report read it. Held in memory only and never written
 * to storage, because it is patient data.
 */

export type PatientSource = 'sample' | 'unusual' | 'entered'

export interface CurrentPatient {
  input: PatientInput
  source: PatientSource
}

export const PATIENT_SOURCE_LABEL: Record<PatientSource, string> = {
  sample: 'Sample patient',
  unusual: 'Unusual patient',
  entered: 'Entered patient',
}

interface PatientStore {
  patients: Partial<Record<DatasetId, CurrentPatient>>
  setPatient: (dataset: DatasetId, patient: CurrentPatient) => void
  clearPatient: (dataset: DatasetId) => void
}

const PatientContext = createContext<PatientStore | null>(null)

export function PatientProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Partial<Record<DatasetId, CurrentPatient>>>({})
  const setPatient = useCallback((dataset: DatasetId, patient: CurrentPatient) => setPatients((p) => ({ ...p, [dataset]: patient })), [])
  const clearPatient = useCallback(
    (dataset: DatasetId) =>
      setPatients((p) => {
        const next = { ...p }
        delete next[dataset]
        return next
      }),
    [],
  )
  const value = useMemo(() => ({ patients, setPatient, clearPatient }), [patients, setPatient, clearPatient])
  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>
}

export interface CurrentPatientValue {
  /** The patient set on Predict, else the dataset's sample patient once the schema has loaded. */
  patient: CurrentPatient | null
  setPatient: (patient: CurrentPatient) => void
  /** Back to the sample patient. */
  clearPatient: () => void
}

export function useCurrentPatient(dataset: DatasetId, schema: FeatureSchema | undefined): CurrentPatientValue {
  const ctx = useContext(PatientContext)
  if (!ctx) throw new Error('useCurrentPatient must be used inside <PatientProvider>')
  const { patients, setPatient, clearPatient } = ctx
  const stored = patients[dataset]
  const sample = schema && schema.dataset === dataset ? schema.samplePatient : undefined
  const patient = useMemo<CurrentPatient | null>(
    () => stored ?? (sample ? { input: sample, source: 'sample' } : null),
    [stored, sample],
  )
  return {
    patient,
    setPatient: useCallback((p: CurrentPatient) => setPatient(dataset, p), [setPatient, dataset]),
    clearPatient: useCallback(() => clearPatient(dataset), [clearPatient, dataset]),
  }
}
