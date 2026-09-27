import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { itemVariants, pageVariants } from '@/lib/motion'

interface PageProps {
  children: ReactNode
  className?: string
  /** Accessible name for the page region. */
  label: string
}

/** Page container: fade in, children stagger 0.04s with a 12px rise. */
export function Page({ children, className = '', label }: PageProps) {
  return (
    <motion.article
      aria-label={label}
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      className={`px-[var(--page-pad-x)] pt-14 pb-24 ${className}`}
    >
      {children}
    </motion.article>
  )
}

interface PageItemProps {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'header' | 'footer'
}

/** A staggered child of <Page>. */
export function PageItem({ children, className = '', as = 'div' }: PageItemProps) {
  const Component = motion[as]
  return (
    <Component variants={itemVariants} className={className}>
      {children}
    </Component>
  )
}
