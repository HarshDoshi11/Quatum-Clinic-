import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { GLOSSARY, type GlossaryKey } from '@/lib/glossary'
import { tQuick } from '@/lib/motion'

interface TermProps {
  /** Glossary key; defaults to the lower-cased text. */
  term?: GlossaryKey
  children: ReactNode
}

const WIDTH = 260
const GAP = 8
const EDGE = 12

/**
 * Jargon with a dotted underline. Hover or focus shows a one-line definition.
 * The tooltip is portalled and clamped to the viewport so it's never clipped.
 */
export function Term({ term, children }: TermProps) {
  const key = (term ?? String(children).toLowerCase()) as GlossaryKey
  const definition = GLOSSARY[key]
  const ref = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null)
  const id = useId()

  const place = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const left = Math.min(Math.max(rect.left + rect.width / 2 - WIDTH / 2, EDGE), window.innerWidth - WIDTH - EDGE)
    const above = rect.top > 96
    setPos({ left, top: above ? rect.top - GAP : rect.bottom + GAP, above })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  if (import.meta.env.DEV && !definition) console.warn(`<Term>: no glossary entry for "${key}"`)
  if (!definition) return <>{children}</>

  return (
    <>
      <span
        ref={ref}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onPointerEnter={() => setOpen(true)}
        onPointerLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        className="cursor-help underline decoration-muted decoration-dotted decoration-1 underline-offset-[3px] hover:decoration-ink"
      >
        {children}
      </span>
      {createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.span
              id={id}
              role="tooltip"
              initial={{ opacity: 0, y: pos.above ? 4 : -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={tQuick}
              style={{ left: pos.left, top: pos.top, width: WIDTH, translate: pos.above ? '0 -100%' : undefined }}
              className="pointer-events-none fixed z-[60] block rounded-[2px] bg-ink px-3 py-2 font-sans text-[12.5px] leading-[1.45] font-normal tracking-normal text-bg normal-case"
            >
              <span className="label-mono mb-1 block text-[10px] opacity-60">{key}</span>
              {definition}
            </motion.span>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
