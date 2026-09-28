import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { easeGentle } from '@/lib/motion'

/** A Patient Mode page: generous padding, and a crossfade with a 12px slide between pages. */
export function PatientPage({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  const reduced = useReducedMotion() ?? false
  return (
    <motion.div
      aria-label={label}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
      transition={{ duration: 0.45, ease: easeGentle }}
      className={`px-6 pt-8 pb-24 md:px-12 ${className}`}
    >
      {children}
    </motion.div>
  )
}
