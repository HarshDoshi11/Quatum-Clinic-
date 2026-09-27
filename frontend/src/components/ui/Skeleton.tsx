interface SkeletonProps {
  /** Width in ch (mono characters) or any CSS length. */
  width?: number | string
  height?: number | string
  className?: string
}

/** Flat placeholder bar. Pulses gently unless reduced motion is requested. */
export function Skeleton({ width = 6, height = '0.9em', className = '' }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block rounded-[1px] bg-rule align-middle motion-safe:animate-pulse ${className}`}
      style={{ width: typeof width === 'number' ? `${width}ch` : width, height }}
    />
  )
}
