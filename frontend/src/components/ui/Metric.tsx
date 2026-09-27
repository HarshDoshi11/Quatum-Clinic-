import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { useEffect } from 'react'

interface AnimatedNumberProps {
  value: number
  format: (n: number) => string
  /** Start value for the count-up. Defaults to 0. */
  from?: number
  className?: string
}

/** A number that springs to its value (counts up on mount, glides on change). */
export function AnimatedNumber({ value, format, from = 0, className = '' }: AnimatedNumberProps) {
  const reduced = useReducedMotion()
  const spring = useSpring(reduced ? value : from, { stiffness: 70, damping: 20, mass: 1 })
  const text = useTransform(spring, (n) => format(n))

  useEffect(() => {
    if (reduced) spring.jump(value)
    else spring.set(value)
  }, [value, reduced, spring])

  return (
    <>
      <motion.span aria-hidden="true" className={`num ${className}`}>
        {text}
      </motion.span>
      {/* Screen readers get the final value, not every frame. */}
      <span className="sr-only">{format(value)}</span>
    </>
  )
}

/** 'xl' = metric-xl token (72px), 'md' = metric token (32px). */
type MetricSize = 'xl' | 'md'

const SIZE: Record<MetricSize, string> = {
  xl: 'type-metric-xl',
  md: 'type-metric',
}

interface MetricProps {
  value: number
  format: (n: number) => string
  size?: MetricSize
  /** Accent for quantum / live values; ink otherwise. */
  tone?: 'ink' | 'accent' | 'muted'
  caption?: React.ReactNode
  className?: string
}

/** Oversized mono numeral with an optional uppercase caption below. */
export function Metric({ value, format, size = 'md', tone = 'ink', caption, className = '' }: MetricProps) {
  const color = tone === 'accent' ? 'text-accent' : tone === 'muted' ? 'text-muted' : 'text-ink'
  return (
    <div className={className}>
      <p className={`${SIZE[size]} ${color}`}>
        <AnimatedNumber value={value} format={format} />
      </p>
      {caption && <div className="type-label mt-3 text-muted">{caption}</div>}
    </div>
  )
}
