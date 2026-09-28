import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BACKENDS } from '@/lib/domain'
import type { BackendId } from '@/types'

/**
 * The backend the current page's numbers come from. The top bar shows it, so it
 * never contradicts the page (e.g. Predict & Trust runs the deployed QSVM on Noisy Sim).
 */
export interface PageBackend {
  backend: BackendId
  qubits: number
}

/** Top-bar wording: "SIM · NOISY", "FAKE · BACKEND-1". */
export const BACKEND_STATUS: Record<BackendId, [string, string]> = {
  'ideal-sim': ['SIM', 'IDEAL'],
  'noisy-sim': ['SIM', 'NOISY'],
  'fake-backend-1': ['FAKE', 'BACKEND-1'],
  'fake-backend-2': ['FAKE', 'BACKEND-2'],
  'ibm-qpu': ['QPU', 'IBM'],
  cpu: ['CPU', 'CLASSICAL'],
}

export const backendTitle = (b: PageBackend): string => `Active backend: ${BACKENDS[b.backend].name}, ${b.qubits} qubits`

interface Store {
  current: PageBackend | null
  set: (b: PageBackend | null) => void
}

const PageBackendContext = createContext<Store | null>(null)

export function PageBackendProvider({ children }: { children: ReactNode }) {
  const [current, set] = useState<PageBackend | null>(null)
  const value = useMemo(() => ({ current, set }), [current])
  return <PageBackendContext.Provider value={value}>{children}</PageBackendContext.Provider>
}

/** A page declares its backend (once its data has loaded); cleared when the page unmounts. */
export function usePageBackend(backend: BackendId | undefined, qubits: number | undefined): void {
  const ctx = useContext(PageBackendContext)
  if (!ctx) throw new Error('usePageBackend must be used inside <PageBackendProvider>')
  const { set } = ctx
  useEffect(() => {
    set(backend && qubits !== undefined ? { backend, qubits } : null)
    return () => set(null)
  }, [set, backend, qubits])
}

export function useCurrentPageBackend(): PageBackend | null {
  return useContext(PageBackendContext)?.current ?? null
}
