import { motion, useReducedMotion } from 'motion/react'

/**
 * A calm visual for Patient Mode Home: a soft sage circle breathing 1.0 ↔ 1.08 over 6s, with a faint
 * outer ring. Decorative only; still under reduced motion.
 */
export function BreathingCircle({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion() ?? false
  const breathe = reduced ? undefined : { scale: [1, 1.08, 1] }
  const loop = { duration: 6, ease: 'easeInOut' as const, repeat: Infinity }
  return (
    <div className={`relative aspect-square ${className}`} aria-hidden="true">
      {/* Faint outer ring, breathing a little behind the circle */}
      <motion.span
        className="absolute inset-0 rounded-full border border-accent opacity-25"
        animate={reduced ? undefined : { scale: [1, 1.04, 1], opacity: [0.25, 0.15, 0.25] }}
        transition={loop}
      />
      <motion.span className="absolute inset-[14%] rounded-full bg-accent-soft" animate={breathe} transition={loop} />
      <motion.span className="absolute inset-[30%] rounded-full bg-accent opacity-20" animate={breathe} transition={{ ...loop, delay: 0.4 }} />
    </div>
  )
}
