import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  body?: ReactNode
  action?: ReactNode
  /** "error" adds a risk-high mark; used for failed loads. */
  tone?: 'neutral' | 'error'
  className?: string
}

/** Quiet placeholder for empty or failed data views. */
export function EmptyState({ title, body, action, tone = 'neutral', className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-start gap-3 border border-dashed border-rule-strong px-6 py-8 ${className}`}>
      <p className="label-mono flex items-center gap-2 text-muted">
        <span className={`block h-[6px] w-[6px] ${tone === 'error' ? 'bg-risk-high' : 'border border-muted'}`} aria-hidden="true" />
        {tone === 'error' ? 'Could not load' : 'Empty'}
      </p>
      <p className="font-serif text-[28px] leading-tight text-ink">{title}</p>
      {body && <div className="max-w-[52ch] text-[14px] leading-6 text-muted">{body}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
