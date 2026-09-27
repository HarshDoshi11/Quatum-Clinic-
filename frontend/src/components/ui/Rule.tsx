interface RuleProps {
  className?: string
  strong?: boolean
  vertical?: boolean
}

/** 1px hairline rule — the app's substitute for cards. */
export function Rule({ className = '', strong = false, vertical = false }: RuleProps) {
  const color = strong ? 'bg-rule-strong' : 'bg-rule'
  return (
    <div
      role="presentation"
      className={`${color} ${vertical ? 'w-px self-stretch' : 'h-px w-full'} shrink-0 ${className}`}
    />
  )
}
