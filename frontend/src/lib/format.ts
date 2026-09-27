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

/** Seconds → "412 s", "2.6 s", "17 min", "1.2 h" */
export function formatDuration(seconds: number): string {
  if (seconds < 10) return `${seconds.toFixed(seconds < 1 ? 2 : 1)} s`
  if (seconds < 120) return `${Math.round(seconds)} s`
  if (seconds < 7200) return `${Math.round(seconds / 60)} min`
  return `${(seconds / 3600).toFixed(1)} h`
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
