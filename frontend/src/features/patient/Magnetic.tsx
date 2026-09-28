import { motion, useReducedMotion, useSpring } from 'motion/react'
import type { PointerEvent, ReactNode } from 'react'

/** At most this far toward the pointer. */
const PULL = 6

/**
 * A soft magnetic pull: the child drifts up to 6px toward the pointer while it hovers, and settles back
 * when it leaves. Off under reduced motion.
 */
export function Magnetic({ children, className = '', onHoverChange }: { children: ReactNode; className?: string; onHoverChange?: (hover: boolean) => void }) {
  const reduced = useReducedMotion() ?? false
  const x = useSpring(0, { stiffness: 180, damping: 18 })
  const y = useSpring(0, { stiffness: 180, damping: 18 })
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType === 'touch') return
    const r = e.currentTarget.getBoundingClientRect()
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
    x.set(Math.max(-1, Math.min(1, dx)) * PULL)
    y.set(Math.max(-1, Math.min(1, dy)) * PULL)
  }
  const leave = () => {
    x.set(0)
    y.set(0)
    onHoverChange?.(false)
  }
  return (
    <motion.div className={`inline-block ${className}`} style={{ x, y }} onPointerMove={move} onPointerEnter={() => onHoverChange?.(true)} onPointerLeave={leave}>
      {children}
    </motion.div>
  )
}
