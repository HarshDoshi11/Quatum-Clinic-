import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { en, type PatientDictionary, type PatientKey } from '@/content/patient/en'
import { hi } from '@/content/patient/hi'
import { mr } from '@/content/patient/mr'
import { readStored, writeStored } from '@/lib/storage'

export const LANGUAGES = ['en', 'hi', 'mr'] as const
export type Language = (typeof LANGUAGES)[number]

/** Each language's own name, and the voice used to read it aloud. */
export const LANGUAGE_INFO: Record<Language, { name: string; speech: string }> = {
  en: { name: 'English', speech: 'en-IN' },
  hi: { name: 'हिन्दी', speech: 'hi-IN' },
  mr: { name: 'मराठी', speech: 'mr-IN' },
}

const DICTIONARIES: Record<Language, PatientDictionary> = { en, hi, mr }
const STORAGE_KEY = 'qc.lang'

interface LanguageValue {
  lang: Language
  setLang: (lang: Language) => void
}

const LanguageContext = createContext<LanguageValue | null>(null)

/** Patient Mode's language (a preference, not patient data, so it is remembered). */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setState] = useState<Language>(() => readStored(STORAGE_KEY, LANGUAGES) ?? 'en')
  const setLang = useCallback((next: Language) => {
    setState(next)
    writeStored(STORAGE_KEY, next)
  }, [])
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>')
  return ctx
}

/** t('home.minutes', { n: 3 }) → "about 3 minutes"; missing translations fall back to English. */
export function useT(): (key: PatientKey, vars?: Record<string, string | number>) => string {
  const { lang } = useLanguage()
  return useCallback(
    (key, vars) => {
      const text = DICTIONARIES[lang][key] ?? en[key]
      return vars ? text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : text
    },
    [lang],
  )
}
