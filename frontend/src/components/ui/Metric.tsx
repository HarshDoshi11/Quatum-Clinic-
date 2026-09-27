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

type MetricSize = 'hero' | 'xl' | 'lg' | 'md'

const SIZE: Record<MetricSize, string> = {
  hero: 'text-[clamp(72px,7vw,112px)] leading-[0.9] tracking-[-0.04em]',
  xl: 'text-[56px] leading-none tracking-[-0.03em]',
  lg: 'text-[40px] leading-none tracking-[-0.02em]',
  md: 'text-[24px] leading-none tracking-[-0.01em]',
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
export function Metric({ value, format, size = 'lg', tone = 'ink', caption, className = '' }: MetricProps) {
  const color = tone === 'accent' ? 'text-accent' : tone === 'muted' ? 'text-muted' : 'text-ink'
  return (
    <div className={className}>
      <p className={`font-mono font-normal ${SIZE[size]} ${color}`}>
        <AnimatedNumber value={value} format={format} />
      </p>
      {caption && <div className="label-mono mt-3 text-muted">{caption}</div>}
    </div>
  )
}
