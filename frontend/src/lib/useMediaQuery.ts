import { useSyncExternalStore } from 'react'

/** Short viewports (e.g. 1366×768): demo-critical pages compact to keep key results on the first screen. Matches `[@media(max-height:52rem)]:`. */
export const SHORT_VIEWPORT = '(max-height: 52rem)'

/** Whether a media query currently matches; updates when it changes. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
