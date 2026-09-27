import type { ReactNode } from 'react'

interface SectionLabelProps {
  /** e.g. "01" — rendered as "01 — LATEST FINDINGS". Omit when the label already contains it. */
  index?: string
  children: ReactNode
  className?: string
  as?: 'p' | 'h2' | 'h3' | 'span'
}

/** Uppercase mono section label: "01 — LATEST FINDINGS". */
export function SectionLabel({ index, children, className = '', as: Tag = 'p' }: SectionLabelProps) {
  return (
    <Tag className={`label-mono text-muted ${className}`}>
      {index !== undefined && (
        <>
          <span className="text-ink">{index}</span>
          <span aria-hidden="true"> — </span>
        </>
      )}
      {children}
    </Tag>
  )
}
