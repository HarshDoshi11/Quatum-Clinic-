/** Display formatting. Numbers are always rendered in IBM Plex Mono by the caller. */

const MINUS = '−'

/** 0.914 → "0.914" */
export const formatAuc = (x: number): string => x.toFixed(3)

/** 0.012 → "±0.012" */
export const formatStd = (x: number, dp = 3): string => `±${x.toFixed(dp)}`

/** −0.007 → "−0.007", 0.004 → "+0.004" */
export const formatDelta = (x: number, dp = 3): string => `${x < 0 ? MINUS : '+'}${Math.abs(x).toFixed(dp)}`

/** 0.842 → "84.2%" */
export const formatPercent = (fraction: number, dp = 1): string => `${(fraction * 100).toFixed(dp)}%`

/** 0.842 → "84.2" */
export const formatPoints = (fraction: number, dp = 1): string => (fraction * 100).toFixed(dp)

/** Negative numbers with a true minus sign. */
export const formatNumber = (x: number, dp = 0): string => (x < 0 ? `${MINUS}${Math.abs(x).toFixed(dp)}` : x.toFixed(dp))

const mmss = (seconds: number): string => {
  const total = Math.round(seconds)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/**
 * A single duration: under 10 s in milliseconds ("40 ms", "2,600 ms"),
 * otherwise mm:ss ("03:04"). For a table column use `durationColumn`.
 */
export function formatDuration(seconds: number): string {
  return seconds < 10 ? formatMs(seconds * 1000) : mmss(seconds)
}

/**
 * One unit for a whole column of durations (rule: never mix units in a column):
 * seconds with 1 decimal when every value is under 10 minutes, otherwise mm:ss.
 * The same formatter is used for the ± spread.
 */
export function durationColumn(values: readonly number[]): (seconds: number) => string {
  const max = values.length ? Math.max(...values) : 0
  if (max < 600) return (s) => (s > 0 && s < 0.05 ? '<0.1 s' : `${s.toFixed(1)} s`)
  return mmss
}

/** Milliseconds with sensible precision; never "0.00" — tiny values read "<0.01 ms". */
export function formatMs(ms: number): string {
  if (ms === 0) return '0 ms'
  if (ms < 0.01) return '<0.01 ms'
  if (ms < 1) return `${ms.toFixed(2)} ms`
  if (ms < 10) return `${ms.toFixed(1)} ms`
  return `${Math.round(ms).toLocaleString('en-US')} ms`
}

// Timestamps are displayed in IST, the lab's timezone, regardless of the viewer's locale.
// Formatted by hand so every browser prints exactly the same string (Intl month names vary: "Sep" / "Sept").
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const IST_OFFSET_MS = 5.5 * 3600_000
const toIst = (iso: string): Date => new Date(new Date(iso).getTime() + IST_OFFSET_MS)
const pad = (n: number): string => String(n).padStart(2, '0')

/** "14:32" */
export const formatTime = (iso: string): string => {
  const d = toIst(iso)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** "27 Sep 2026" */
export const formatDate = (iso: string): string => {
  const d = toIst(iso)
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** "27 Sep 2026 · 14:32" */
export const formatDateTime = (iso: string): string => `${formatDate(iso)} · ${formatTime(iso)}`
