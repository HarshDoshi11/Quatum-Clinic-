type HeadlineSize = 'xl' | 'lg' | 'md'

interface HeadlineProps {
  /** A string, or an array of lines for forced breaks. */
  children: string | readonly string[]
  size?: HeadlineSize
  as?: 'h1' | 'h2'
  className?: string
  id?: string
}

const SIZE: Record<HeadlineSize, string> = {
  xl: 'text-[length:var(--text-display-xl)]',
  lg: 'text-[length:var(--text-display-lg)]',
  md: 'text-[length:var(--text-display-md)]',
}

/** Instrument Serif display headline. Always a single ink color. */
export function Headline({ children, size = 'lg', as: Tag = 'h1', className = '', id }: HeadlineProps) {
  const lines = typeof children === 'string' ? [children] : children
  return (
    <Tag
      id={id}
      className={`font-serif font-normal text-ink leading-[0.95] tracking-[-0.015em] text-balance ${SIZE[size]} ${className}`}
    >
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
