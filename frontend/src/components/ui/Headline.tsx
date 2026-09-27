interface HeadlineProps {
  /** A string, or an array of lines for forced breaks. */
  children: string | readonly string[]
  /**
   * 'display' uses the display token (clamp 56–96px).
   * 'custom' keeps the display face but takes its size from className.
   */
  size?: 'display' | 'custom'
  as?: 'h1' | 'h2'
  className?: string
  id?: string
}

/** Instrument Serif page headline. Always a single ink colour. */
export function Headline({ children, size = 'display', as: Tag = 'h1', className = '', id }: HeadlineProps) {
  const lines = typeof children === 'string' ? [children] : children
  const sizeClass = size === 'display' ? 'type-display' : 'font-serif font-normal leading-none tracking-[-0.015em]'
  return (
    <Tag id={id} className={`${sizeClass} text-balance text-ink ${className}`}>
      {lines.length === 1
        ? lines[0]
        : lines.map((line) => (
            // Forced lines never re-wrap.
            <span key={line} className="block whitespace-nowrap">
              {line}
            </span>
          ))}
    </Tag>
  )
}
