/** localStorage wrappers that never throw (private mode, blocked storage). */

export function readStored<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const value = window.localStorage.getItem(key)
    return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable — preference simply won't persist.
  }
}
