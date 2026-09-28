/**
 * Patient Mode's languages. English is live; Hindi and Marathi have their slots in the switcher and turn on
 * when their text is ready (set `available`).
 */
export interface PatientLanguage {
  code: 'en' | 'hi' | 'mr'
  /** Shown in the switcher, in its own script. */
  label: string
  /** Full name, for screen readers and tooltips. */
  name: string
  available: boolean
}

export const PATIENT_LANGUAGES: readonly PatientLanguage[] = [
  { code: 'en', label: 'EN', name: 'English', available: true },
  { code: 'hi', label: 'हि', name: 'हिन्दी (Hindi)', available: false },
  { code: 'mr', label: 'म', name: 'मराठी (Marathi)', available: false },
]
