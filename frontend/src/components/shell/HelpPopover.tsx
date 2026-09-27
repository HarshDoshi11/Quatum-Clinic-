import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Term } from '@/components/ui/Term'
import { SHORTCUTS, useShortcuts } from '@/features/shortcuts/Shortcuts'
import { useTour } from '@/features/tour/Tour'
import { tQuick } from '@/lib/motion'
import { useDismiss } from '@/lib/useDismiss'

const LEGEND: readonly { swatch: string; label: ReactNode }[] = [
  { swatch: 'bg-accent', label: 'Quantum model / live value' },
  { swatch: 'bg-classical', label: <>Classical <Term term="baseline">baseline</Term></> },
  { swatch: 'bg-risk-low', label: 'Lower risk' },
  { swatch: 'bg-risk-mid', label: 'Moderate risk' },
  { swatch: 'bg-risk-high', label: 'Higher risk' },
]


/** The app's single help affordance. */
export function HelpPopover() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const close = useCallback(() => setOpen(false), [])
  const dismissRefs = useMemo(() => [buttonRef, panelRef], [])
  useDismiss(dismissRefs, open, close)
  const { startTour } = useTour()
  const { openShortcuts } = useShortcuts()

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Help"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`num flex h-9 w-9 items-center justify-center rounded-[2px] border type-small ${
          open ? 'border-ink text-ink' : 'border-rule text-muted hover:border-rule-strong hover:text-ink'
        }`}
      >
        ?
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="Help"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={tQuick}
            className="absolute top-[calc(100%+6px)] right-0 z-40 w-[23rem] rounded-[2px] border border-rule-strong bg-bg p-5"
          >
            <p className="type-h2">How to read this lab</p>
            <p className="mt-2 type-small text-muted">
              Each page answers one question. Read the one-line takeaway above a chart first, then the chart. Dotted
              underlines explain jargon on hover, like <Term>AUC</Term>.
            </p>
            <Button
              size="sm"
              className="mt-4 w-full"
              onClick={() => {
                setOpen(false)
                startTour()
              }}
            >
              Take the 8-step guided tour →
            </Button>

            <p className="type-label mt-5 mb-2 text-muted">Colour key</p>
            <ul className="flex flex-col gap-1.5">
              {LEGEND.map((item) => (
                <li key={item.swatch} className="flex items-center gap-3 type-small">
                  <span className={`block h-2 w-2 ${item.swatch}`} aria-hidden="true" />
                  {item.label}
                </li>
              ))}
            </ul>

            <p className="type-label mt-5 mb-2 text-muted">Keyboard</p>
            <ul className="flex flex-col gap-1.5">
              {SHORTCUTS.slice(0, 4).map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-4 type-small">
                  <span>{s.label}</span>
                  <kbd className="type-label shrink-0 rounded-[2px] border border-rule px-1.5 py-0.5 text-muted">{s.keys.join(' ')}</kbd>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                openShortcuts()
              }}
              className="type-label mt-3 text-ink underline-offset-4 hover:underline"
            >
              All shortcuts ↗
            </button>

            <p className="type-label mt-5 border-t border-rule pt-3 text-muted">Decision support · not a diagnosis</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
