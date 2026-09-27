import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PATIENT_BASE } from '@/routes'

export type Mode = 'research' | 'patient'

/** Last visited path per mode, so toggling returns you where you were. */
const lastPath: Record<Mode, string> = { research: '/', patient: PATIENT_BASE }

export function modeForPath(pathname: string): Mode {
  return pathname === PATIENT_BASE || pathname.startsWith(`${PATIENT_BASE}/`) ? 'patient' : 'research'
}

/**
 * Mode is derived from the URL (/patient/* = Patient Mode), so it can never
 * disagree with what's on screen, and deep links / back button just work.
 */
export function useMode(): { mode: Mode; setMode: (mode: Mode) => void } {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const mode = modeForPath(pathname)

  const setMode = useCallback(
    (next: Mode) => {
      if (next === mode) return
      lastPath[mode] = pathname
      navigate(lastPath[next])
    },
    [mode, pathname, navigate],
  )

  return { mode, setMode }
}
