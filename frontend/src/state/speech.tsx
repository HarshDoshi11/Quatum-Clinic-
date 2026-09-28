import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { LANGUAGE_INFO, useLanguage } from './language'

const supported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

interface SpeechValue {
  supported: boolean
  speaking: boolean
  /** Reads the current screen's main text (registered with useSpeakable), or stops. */
  toggle: () => void
  stop: () => void
  register: (text: string | null) => void
}

const SpeechContext = createContext<SpeechValue | null>(null)

/**
 * Read aloud with the browser's own voice (Web Speech API; nothing leaves the device), in the patient's
 * language (en-IN / hi-IN / mr-IN). Stops when the page changes.
 */
export function SpeechProvider({ children }: { children: ReactNode }) {
  const { lang } = useLanguage()
  const { pathname } = useLocation()
  const [speaking, setSpeaking] = useState(false)
  const text = useRef<string | null>(null)
  const canSpeak = supported()

  const stop = useCallback(() => {
    if (canSpeak) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [canSpeak])

  const toggle = useCallback(() => {
    if (!canSpeak) return
    if (speaking) {
      stop()
      return
    }
    if (!text.current) return
    const u = new SpeechSynthesisUtterance(text.current)
    u.lang = LANGUAGE_INFO[lang].speech
    u.rate = 0.95
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
    setSpeaking(true)
  }, [canSpeak, speaking, stop, lang])

  useEffect(() => stop(), [pathname, stop])
  useEffect(() => () => {
    if (supported()) window.speechSynthesis.cancel()
  }, [])

  const register = useCallback((t: string | null) => {
    text.current = t
  }, [])
  const value = useMemo(() => ({ supported: canSpeak, speaking, toggle, stop, register }), [canSpeak, speaking, toggle, stop, register])
  return <SpeechContext.Provider value={value}>{children}</SpeechContext.Provider>
}

export function useSpeech(): SpeechValue {
  const ctx = useContext(SpeechContext)
  if (!ctx) throw new Error('useSpeech must be used inside <SpeechProvider>')
  return ctx
}

/** Registers the current screen's main text for the read-aloud toggle. */
export function useSpeakable(text: string | null): void {
  const { register } = useSpeech()
  useEffect(() => {
    register(text)
    return () => register(null)
  }, [text, register])
}
