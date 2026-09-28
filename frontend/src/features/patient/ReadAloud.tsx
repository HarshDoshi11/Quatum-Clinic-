import { Square, Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

const supported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

/** Reads the given text aloud with the browser's own voice (nothing leaves the device); hidden where unsupported. */
export function ReadAloud({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false)
  // Stop when leaving the page.
  useEffect(() => () => {
    if (supported()) window.speechSynthesis.cancel()
  }, [])
  if (!supported()) return null
  const toggle = () => {
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.95
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
    setSpeaking(true)
  }
  return (
    <Button variant="outline" onClick={toggle} aria-pressed={speaking}>
      {speaking ? <Square size="1rem" strokeWidth={1.5} aria-hidden="true" /> : <Volume2 size="1.125rem" strokeWidth={1.5} aria-hidden="true" />}
      {speaking ? 'Stop reading' : 'Read aloud'}
    </Button>
  )
}
