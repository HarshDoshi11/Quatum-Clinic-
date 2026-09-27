import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface DataVersionValue {
  /** Increments whenever server-side data changes (train, re-run). Add to useResource deps to refetch. */
  version: number
  invalidate: () => void
}

const DataVersionContext = createContext<DataVersionValue | null>(null)

export function DataVersionProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0)
  const invalidate = useCallback(() => setVersion((v) => v + 1), [])
  const value = useMemo(() => ({ version, invalidate }), [version, invalidate])
  return <DataVersionContext.Provider value={value}>{children}</DataVersionContext.Provider>
}

export function useDataVersion(): DataVersionValue {
  const ctx = useContext(DataVersionContext)
  if (!ctx) throw new Error('useDataVersion must be used inside <DataVersionProvider>')
  return ctx
}
