import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { easeGentle } from '@/lib/motion'

/**
 * A Patient Mode section that fades up softly the first time it scrolls into view. Printing always
 * shows it (a section never scrolled to would otherwise print blank).
 */
export function Reveal({ children, className = '', label }: { children: ReactNode; className?: string; label?: string }) {
  const reduced = useReducedMotion() ?? false
  return (
    <motion.section
      aria-label={label}
      initial={reduced ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.45, ease: easeGentle }}
      className={`print:!transform-none print:!opacity-100 ${className}`}
    >
      {children}
    </motion.section>
  )
}
