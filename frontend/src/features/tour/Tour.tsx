import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { easePrecise } from '@/lib/motion'
import { isMac } from '@/lib/platform'

interface TourStep {
  /** Matches a `data-tour` attribute on the target element. */
  target: string
  label: string
  title: string
  body: string
}

const STEPS: TourStep[] = [
  {
    target: 'headline',
    label: 'The question',
    title: 'Three questions, in order',
    body: 'This lab asks: does quantum help, does it survive real hardware, and can a patient trust it? The sidebar follows the same order.',
  },
  {
    target: 'bloch',
    label: 'Fig. 01',
    title: 'One qubit, one patient feature',
    body: 'Move the feature slider: the value tilts the qubit, and measuring it gives the chance of reading 0 or 1. Raise the noise to watch the signal fade.',
  },
  {
    target: 'findings',
    label: 'Latest findings',
    title: 'The three headline results',
    body: 'Blue numbers are measured results. Each one links to the page that explains it and to the experiment that produced it.',
  },
  {
    target: 'pipeline',
    label: 'Hybrid pipeline',
    title: 'Where quantum fits in',
    body: 'Grey stages run on a normal computer, blue stages on a quantum one. Hover any stage for a one-line explanation.',
  },
  {
    target: 'experiments',
    label: 'Recent experiments',
    title: 'Every run is recorded',
    body: 'Click a row to open its full configuration and metrics, copy its ID, or run it again.',
  },
  {
    target: 'backends',
    label: 'Backends',
    title: 'Where circuits run',
    body: 'Perfect simulators, simulators with realistic noise, and real hardware. Every result says which one it came from.',
  },
  {
    target: 'mode',
    label: 'Mode',
    title: 'Research or Patient',
    body: 'Patient mode hides the lab detail and explains a single result in calm, plain language.',
  },
  {
    target: 'palette',
    label: 'Command palette',
    title: 'Jump anywhere',
    body: `Press ${isMac ? '⌘K' : 'Ctrl K'} to jump to a page, switch dataset or open an experiment. Turn on Plain language for a simple explanation under every section.`,
  },
]

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const PAD = 8
const CARD_W = 400
const CARD_H = 280
const EDGE = 16

// ─── Context ────────────────────────────────────────────────

interface TourValue {
  startTour: () => void
}

const TourContext = createContext<TourValue | null>(null)

export function useTour(): TourValue {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used inside <TourProvider>')
  return ctx
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<number | null>(null)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { toast } = useToast()

  const startTour = useCallback(() => {
    if (pathname !== '/') navigate('/')
    // Let the Overview mount (and its page transition settle) before measuring.
    window.setTimeout(() => setStep(0), pathname === '/' ? 50 : 700)
  }, [pathname, navigate])

  const end = useCallback(
    (completed: boolean) => {
      setStep(null)
      if (completed) toast('Tour complete · press ? to replay')
    },
    [toast],
  )

  const value = useMemo(() => ({ startTour }), [startTour])

  return (
    <TourContext.Provider value={value}>
      {children}
      {step !== null && <TourOverlay step={step} setStep={setStep} onEnd={end} />}
    </TourContext.Provider>
  )
}

// ─── Overlay ────────────────────────────────────────────────

function useTargetRect(target: string, reduced: boolean): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
    if (!el) {
      setRect(null)
      return
    }
    el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
    let frame = 0
    const measure = () => {
      const r = el.getBoundingClientRect()
      setRect((prev) =>
        prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height
          ? prev
          : { top: r.top, left: r.left, width: r.width, height: r.height },
      )
      frame = requestAnimationFrame(measure)
    }
    measure()
    return () => cancelAnimationFrame(frame)
  }, [target, reduced])

  return rect
}

/** Card goes below, above, or beside the target — whichever fits in the viewport. */
function placeCard(r: Rect): { top: number; left: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const clampLeft = (x: number) => Math.min(Math.max(x, EDGE), vw - CARD_W - EDGE)
  const clampTop = (y: number) => Math.min(Math.max(y, EDGE), vh - CARD_H - EDGE)
  const below = r.top + r.height + PAD + 12
  const above = r.top - PAD - 12 - CARD_H
  if (below + CARD_H < vh - EDGE) return { top: below, left: clampLeft(r.left) }
  if (above > EDGE) return { top: above, left: clampLeft(r.left) }
  if (r.left - CARD_W - 24 > EDGE) return { top: clampTop(r.top + 40), left: r.left - CARD_W - 24 }
  return { top: clampTop(r.top + 40), left: clampLeft(r.left + r.width + 24) }
}

interface TourOverlayProps {
  step: number
  setStep: (step: number) => void
  onEnd: (completed: boolean) => void
}

function TourOverlay({ step, setStep, onEnd }: TourOverlayProps) {
  const reduced = useReducedMotion() ?? false
  const current = STEPS[step]
  const rect = useTargetRect(current.target, reduced)
  const nextRef = useRef<HTMLButtonElement>(null)
  const last = step === STEPS.length - 1

  const next = useCallback(() => (last ? onEnd(true) : setStep(step + 1)), [last, onEnd, setStep, step])
  const back = useCallback(() => step > 0 && setStep(step - 1), [setStep, step])

  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true })
  }, [step])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEnd(false)
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, back, onEnd])

  // Clamp the outline to the visible area (the scroll container for page content) so tall targets keep a clean frame.
  const bounds = useMemo(() => {
    const el = document.querySelector(`[data-tour="${current.target}"]`)
    const main = document.getElementById('main')
    if (el && main?.contains(el)) {
      const m = main.getBoundingClientRect()
      return { top: m.top + 4, bottom: m.bottom - 4 }
    }
    return { top: 4, bottom: window.innerHeight - 4 }
  }, [current.target])
  const outline = rect && {
    top: Math.max(rect.top - PAD, bounds.top),
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: Math.min(rect.top + rect.height + PAD, bounds.bottom) - Math.max(rect.top - PAD, bounds.top),
  }
  const card = outline ? placeCard({ top: outline.top + PAD, left: outline.left + PAD, width: outline.width - PAD * 2, height: outline.height - PAD * 2 }) : null
  const transition = reduced ? { duration: 0 } : { duration: 0.35, ease: easePrecise }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[85]">
      {outline && (
        <motion.div
          aria-hidden="true"
          className="absolute rounded-[2px] border border-accent"
          initial={false}
          animate={outline}
          transition={transition}
        />
      )}
      {card && (
        <motion.div
          role="dialog"
          aria-modal="false"
          aria-label={`Guided tour, step ${step + 1} of ${STEPS.length}`}
          className="shadow-float pointer-events-auto absolute rounded-[4px] bg-bg p-5"
          style={{ width: CARD_W }}
          initial={false}
          animate={card}
          transition={transition}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={reduced ? { duration: 0 } : { duration: 0.2, ease: easePrecise }}
              aria-live="polite"
            >
              <p className="type-label text-muted">
                <span className="text-accent">
                  Step {step + 1} / {STEPS.length}
                </span>{' '}
                — {current.label}
              </p>
              <p className="mt-3 type-h2 text-ink">{current.title}</p>
              <p className="mt-2 type-body text-muted">{current.body}</p>
            </motion.div>
          </AnimatePresence>
          <div className="mt-5 flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => onEnd(false)} className="!px-0">
              Skip tour
            </Button>
            <span className="flex-1" />
            <Button size="sm" variant="outline" onClick={back} disabled={step === 0}>
              ← Back
            </Button>
            <Button ref={nextRef} size="sm" onClick={next}>
              {last ? 'Finish' : 'Next →'}
            </Button>
          </div>
          {/* Progress rule */}
          <div className="mt-4 h-px bg-rule" aria-hidden="true">
            <motion.div
              className="h-px bg-accent"
              initial={false}
              animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              transition={transition}
            />
          </div>
        </motion.div>
      )}
    </div>,
    document.body,
  )
}
