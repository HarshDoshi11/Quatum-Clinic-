import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { readStored, writeStored } from '@/lib/storage'

const STORAGE_KEY = 'qc.plain'
const VALUES = ['on', 'off'] as const

interface PlainLanguageValue {
  /** When on, every section shows an extra "In simple words:" line. */
  plain: boolean
  setPlain: (on: boolean) => void
  togglePlain: () => void
}

const PlainLanguageContext = createContext<PlainLanguageValue | null>(null)

export function PlainLanguageProvider({ children }: { children: ReactNode }) {
  const [plain, setPlainState] = useState(() => readStored(STORAGE_KEY, VALUES) === 'on')

  const setPlain = useCallback((on: boolean) => {
    writeStored(STORAGE_KEY, on ? 'on' : 'off')
    setPlainState(on)
  }, [])

  const togglePlain = useCallback(() => {
    setPlainState((prev) => {
      writeStored(STORAGE_KEY, prev ? 'off' : 'on')
      return !prev
    })
  }, [])

  const value = useMemo(() => ({ plain, setPlain, togglePlain }), [plain, setPlain, togglePlain])
  return <PlainLanguageContext.Provider value={value}>{children}</PlainLanguageContext.Provider>
}

export function usePlainLanguage(): PlainLanguageValue {
  const ctx = useContext(PlainLanguageContext)
  if (!ctx) throw new Error('usePlainLanguage must be used inside <PlainLanguageProvider>')
  return ctx
}
