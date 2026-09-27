import { AnimatePresence, motion } from 'motion/react'
import {
  cloneElement,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react'
import { createPortal } from 'react-dom'
import { tQuick } from '@/lib/motion'

const GAP = 8
const EDGE = 12

interface TriggerProps {
  ref?: Ref<HTMLElement>
  onPointerEnter?: (e: PointerEvent) => void
  onPointerLeave?: (e: PointerEvent) => void
  onFocus?: (e: FocusEvent) => void
  onBlur?: (e: FocusEvent) => void
  onKeyDown?: (e: KeyboardEvent) => void
  'aria-describedby'?: string
}

interface TooltipProps {
  /** Small uppercase mono label above the body (e.g. the term, or "Quantum"). */
  label?: ReactNode
  content: ReactNode
  /** A single focusable element; it receives the hover/focus handlers. */
  children: ReactElement<TriggerProps>
  width?: number
}

/**
 * Hover/focus tooltip, portalled and clamped to the viewport so it's never
 * clipped by scroll containers. Esc hides it.
 */
export function Tooltip({ label, content, children, width = 260 }: TooltipProps) {
  const ref = useRef<HTMLElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null)
  const id = useId()

  const place = useCallback(() => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, EDGE), window.innerWidth - width - EDGE)
    const above = rect.top > 140
    setPos({ left, top: above ? rect.top - GAP : rect.bottom + GAP, above })
  }, [width])

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

  const trigger = cloneElement(children, {
    ref,
    'aria-describedby': open ? id : undefined,
    onPointerEnter: () => setOpen(true),
    onPointerLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
      children.props.onKeyDown?.(e)
    },
  })

  return (
    <>
      {trigger}
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
              style={{ left: pos.left, top: pos.top, width, translate: pos.above ? '0 -100%' : undefined }}
              className="pointer-events-none fixed z-[90] block rounded-[2px] bg-ink px-3 py-2 font-sans type-small font-normal tracking-normal text-bg normal-case"
            >
              {label && <span className="type-label mb-1 block opacity-80">{label}</span>}
              {content}
            </motion.span>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
