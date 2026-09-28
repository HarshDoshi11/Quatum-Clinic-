/**
 * One shared heartbeat for the Home hero, so the 3D heart and the ECG line move together. Both read the
 * same clock (performance.now) and the same beat phase: the heart's pulse peaks as the ECG spike passes.
 */
export const BPM = 60
export const BEAT_MS = 60_000 / BPM
/** Where the spike (QRS) sits within one beat, 0–1. */
export const QRS_AT = 0.3

/** Position within the current beat, 0–1. */
export function beatPhase(now: number): number {
  return (now % BEAT_MS) / BEAT_MS
}

/** A smooth bump centred at `at`, `width` wide on each side. */
function bump(phase: number, at: number, width: number, amp: number): number {
  const d = (phase - at) / width
  return Math.abs(d) < 1 ? amp * 0.5 * (1 + Math.cos(Math.PI * d)) : 0
}

/** The heart's scale at a beat phase: a quick "lub" on the spike, a softer "dub" after it, then rest. */
export function pulseScale(phase: number): number {
  return 1 + bump(phase, QRS_AT + 0.03, 0.09, 0.05) + bump(phase, QRS_AT + 0.24, 0.1, 0.022)
}

/** The ECG trace at a beat phase, roughly −0.3…1 (up is positive): P wave, QRS spike, T wave. */
export function ecgValue(phase: number): number {
  const g = (at: number, w: number, a: number) => a * Math.exp(-(((phase - at) / w) ** 2))
  return g(QRS_AT - 0.14, 0.025, 0.12) + g(QRS_AT - 0.022, 0.008, -0.15) + g(QRS_AT, 0.011, 1) + g(QRS_AT + 0.024, 0.009, -0.28) + g(QRS_AT + 0.25, 0.045, 0.24)
}
