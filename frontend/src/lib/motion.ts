import type { Transition, Variants } from 'motion/react'

/** Shared motion vocabulary: quick, precise, never bouncy. */

export const easePrecise: [number, number, number, number] = [0.2, 0, 0, 1]

export const tQuick: Transition = { duration: 0.2, ease: easePrecise }
export const tBase: Transition = { duration: 0.3, ease: easePrecise }

/** Spring for slider-driven values and sliding indicators. */
export const springPrecise: Transition = { type: 'spring', stiffness: 120, damping: 20, mass: 1 }

/** Faster spring for layoutId indicators (sidebar marker, toggles). */
export const springIndicator: Transition = { type: 'spring', stiffness: 520, damping: 44, mass: 0.8 }

/** Page container: fades in and staggers its children by 0.04s. */
export const pageVariants: Variants = {
  initial: { opacity: 0 },
  enter: {
    opacity: 1,
    transition: { duration: 0.2, ease: easePrecise, staggerChildren: 0.04, delayChildren: 0.02 },
  },
  exit: { opacity: 0, transition: { duration: 0.15, ease: easePrecise } },
}

/** Page child: fades in with a 12px upward slide. */
export const itemVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easePrecise } },
  exit: { opacity: 0 },
}
