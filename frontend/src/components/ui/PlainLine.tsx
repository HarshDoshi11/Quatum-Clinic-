import { AnimatePresence, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { easePrecise } from '@/lib/motion'
import { usePlainLanguage } from '@/state/plainLanguage'

/**
 * Muted "In simple words: …" line. Rendered only while Plain language is on.
 * Every section title and page header carries one (see CLAUDE.md).
 */
export function PlainLine({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { plain } = usePlainLanguage()
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
          <span className="block max-w-[72ch] pt-3 text-[14px] leading-6 text-muted">
            <span className="label-mono mr-2 text-ink">In simple words:</span>
            {children}
          </span>
        </motion.p>
      )}
    </AnimatePresence>
  )
}
