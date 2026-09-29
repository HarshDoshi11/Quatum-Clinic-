/**
 * The one safety rule, shared by the mock/API layer (takeaways) and the UI
 * (colours, badges): a sensitivity is only "safe" or "unsafe" when it clears
 * the threshold by more than its seed std; otherwise it is "borderline".
 * Relative imports only — the mocks and scripts use this file too.
 */
import type { SafetyStatus } from '../types/hardware'
import { formatPercent } from './format'
import { formatPercentStd } from '@/lib/format'

export function safetyStatus(value: number, std: number, threshold: number): SafetyStatus {
  if (value - std >= threshold) return 'safe'
  if (value + std < threshold) return 'unsafe'
  return 'borderline'
}

export const SAFETY_LABEL: Record<SafetyStatus, string> = {
  safe: 'Safe',
  borderline: 'Borderline · within seed noise',
  unsafe: 'Unsafe',
}

/** Worst status first — used to colour a surface tile from its four corners. */
export const SAFETY_RANK: Record<SafetyStatus, number> = { unsafe: 0, borderline: 1, safe: 2 }

const STATUS_PHRASE: Record<SafetyStatus, (t: string) => string> = {
  safe: (t) => `stays above the ${t} threshold beyond seed noise`,
  borderline: (t) => `is within seed noise of the ${t} threshold`,
  unsafe: (t) => `sits below the ${t} threshold beyond seed noise`,
}

/** "stays above the 85% threshold beyond seed noise" — for a sensitivity ± std against the safety threshold. */
export function safetyPhrase(value: number, std: number, threshold: number): string {
  return STATUS_PHRASE[safetyStatus(value, std, threshold)](`${Math.round(threshold * 100)}% safety`)
}

/**
 * Reading of one operating point (Predict & Trust): used by the API for the
 * default threshold and by the page for a threshold the user picks.
 */
export function operatingSentence(
  threshold: number,
  point: { sensitivity: number; sensitivityStd: number; specificity: number; specificityStd: number },
  safeSensitivity: number,
  isDefault: boolean,
): string {
  const at = `${isDefault ? 'At the default decision threshold of' : 'At a decision threshold of'} ${Math.round(threshold * 100)}%`
  const pm = formatPercentStd
  return `${at}, sensitivity is ${formatPercent(point.sensitivity)} (${pm(point.sensitivityStd)}) and specificity ${formatPercent(point.specificity)} (${pm(point.specificityStd)}); sensitivity ${safetyPhrase(point.sensitivity, point.sensitivityStd, safeSensitivity)}.`
}

/** "On FakeBackend-1, sensitivity falls from 95.6% to 82.6% (±1.8) and sits below the 85% threshold beyond seed noise." */
export function noiseRunSentence(where: string, reference: number, value: number, std: number, threshold: number): string {
  const t = `${Math.round(threshold * 100)}%`
  const status = safetyStatus(value, std, threshold)
  if (value >= reference - 1e-9) return `On ${where}, sensitivity is ${formatPercent(value)} — the noiseless reference — and ${STATUS_PHRASE[status](t)}.`
  return `On ${where}, sensitivity falls from ${formatPercent(reference)} to ${formatPercent(value)} (${formatPercentStd(std)}) and ${STATUS_PHRASE[status](t)}.`
}

export interface EnvelopeCounts {
  safe: number
  borderline: number
  unsafe: number
  total: number
}

export function envelopeCounts(sensitivity: number[][], std: number[][], threshold: number): EnvelopeCounts {
  const counts: EnvelopeCounts = { safe: 0, borderline: 0, unsafe: 0, total: 0 }
  sensitivity.forEach((row, i) =>
    row.forEach((s, j) => {
      counts[safetyStatus(s, std[i]?.[j] ?? 0, threshold)] += 1
      counts.total += 1
    }),
  )
  return counts
}

/** Failure-envelope headline for any threshold (the API uses it for the default; the page for user input). */
export function envelopeSentence(
  sensitivity: number[][],
  std: number[][],
  threshold: number,
  current: { sensitivity: number; std: number; profileName: string },
): string {
  const c = envelopeCounts(sensitivity, std, threshold)
  const t = `${Math.round(threshold * 1000) / 10}%`
  const pct = (n: number) => `${Math.round((n / c.total) * 100)}%`
  const here = safetyStatus(current.sensitivity, current.std, threshold)
  return `With the threshold at ${t}, ${pct(c.safe)} of tested conditions are safe beyond seed noise and ${pct(c.borderline)} are borderline; ${current.profileName} (${formatPercent(current.sensitivity)} ±${(current.std * 100).toFixed(1)}) ${STATUS_PHRASE[here](t)}.`
}
