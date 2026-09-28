import { Fragment, createElement, type ReactNode } from 'react'
import type { PatientLanguage } from '@/lib/patientLanguages'
import type { DatasetId } from '@/types'
import { common } from './en/common'
import { heart } from './en/heart'
import { wdbc } from './en/wdbc'
import type { DatasetStrings } from './types'

export type { DatasetStrings, FeatureStrings, OptionStrings } from './types'

/** Every word Patient Mode shows, for one language. */
export type PatientStrings = typeof common & { datasets: Record<DatasetId, DatasetStrings> }

export const PATIENT_EN: PatientStrings = { ...common, datasets: { heart, wdbc } }

/** Languages with their text ready; the others fall back to English until they are. */
const STRINGS: Record<PatientLanguage['code'], PatientStrings | null> = { en: PATIENT_EN, hi: null, mr: null }

/** Patient Mode's words in the current language (English for now; the switcher has the other slots). */
export function usePatientStrings(): PatientStrings {
  return STRINGS.en ?? PATIENT_EN
}

/** Fills {placeholders} in a string. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m))
}

/** Fills {placeholders} with React nodes (e.g. a highlighted phrase). */
export function fillNodes(template: string, values: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const key = part.match(/^\{(\w+)\}$/)?.[1]
    return createElement(Fragment, { key: i }, key && key in values ? values[key] : part)
  })
}
