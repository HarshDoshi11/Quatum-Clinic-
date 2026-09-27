import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { tQuick } from '@/lib/motion'

export type ToastTone = 'neutral' | 'accent' | 'error'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)
const DURATION = 4000
const MAX = 3

const MARK: Record<ToastTone, string> = { neutral: 'bg-ink', accent: 'bg-accent', error: 'bg-risk-high' }

/** Minimal mono toasts, bottom-left, above the status strip. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), [])

  const toast = useCallback(
    (message: string, tone: ToastTone = 'neutral') => {
      nextId.current += 1
      const id = nextId.current
      setItems((list) => [...list.slice(-(MAX - 1)), { id, message, tone }])
      window.setTimeout(() => dismiss(id), DURATION)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-[calc(var(--strip-h)+16px)] left-[calc(var(--sidebar-w)+16px)] z-[70] flex flex-col items-start gap-2"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={tQuick}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex items-center gap-3 rounded-[2px] border border-rule-strong bg-bg px-3 py-2"
            >
              <span className={`block h-[6px] w-[6px] shrink-0 ${MARK[t.tone]}`} aria-hidden="true" />
              <span className="label-mono text-ink">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="label-mono ml-2 text-muted hover:text-ink"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
