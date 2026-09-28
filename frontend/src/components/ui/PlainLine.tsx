import { AnimatePresence, motion } from 'motion/react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { easePrecise } from '@/lib/motion'
import { useMode } from '@/state/mode'
import { usePlainLanguage } from '@/state/plainLanguage'
import { Tooltip } from './Tooltip'

/**
 * Muted "In simple words: …" line. Rendered only while Plain language is on.
 * Every section title and page header carries one (see CLAUDE.md).
 */
export function PlainLine({ children, className = '' }: { children: ReactNode; className?: string }) {
  // Patient Mode copy is always plain, so it has no toggle and no extra line.
  const { plain: plainOn } = usePlainLanguage()
  const { mode } = useMode()
  const plain = plainOn && mode === 'research'
  return (
    <AnimatePresence initial={false}>
      {plain && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: easePrecise }}
          className={`overflow-hidden ${className}`}
        >
          <span className="measure block pt-3 type-body text-muted">
            <span className="type-label mr-2 text-ink">In simple words:</span>
            {children}
          </span>
        </motion.p>
      )}
    </AnimatePresence>
  )
}

/**
 * Compact "In simple words" line for dense, demo-critical pages: type-small, muted, one line.
 * When the sentence doesn't fit, it truncates and a "more" link opens the full text in a popover.
 * Follows the Plain language toggle like PlainLine (fade + height, 200ms).
 */
export function CompactPlainLine({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { plain: plainOn } = usePlainLanguage()
  const { mode } = useMode()
  const plain = plainOn && mode === 'research'
  const textRef = useRef<HTMLSpanElement>(null)
  const [overflows, setOverflows] = useState(false)
  useLayoutEffect(() => {
    const el = textRef.current
    if (!plain || !el) return
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [plain, children])
  return (
    <AnimatePresence initial={false}>
      {plain && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: easePrecise }}
          className={`overflow-hidden ${className}`}
        >
          <span className="flex min-w-0 items-baseline gap-2 pt-1 type-small text-muted">
            <span ref={textRef} className="min-w-0 truncate">
              <span className="text-ink">In simple words:</span> {children}
            </span>
            {overflows && (
              <Tooltip label="In simple words" content={children} width={300}>
                <button type="button" className="shrink-0 text-ink underline underline-offset-4 transition-colors duration-150 hover:text-muted">
                  more
                </button>
              </Tooltip>
            )}
          </span>
        </motion.p>
      )}
    </AnimatePresence>
  )
}
