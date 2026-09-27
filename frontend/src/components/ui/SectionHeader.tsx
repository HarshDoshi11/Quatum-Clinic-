import type { ReactNode } from 'react'
import { SectionLabel } from './SectionLabel'

interface SectionHeaderProps {
  index: string
  title: string
  /** Right-aligned slot, e.g. an ExperimentTag. */
  aside?: ReactNode
  id?: string
}

/** Hairline rule + "01 — TITLE" label, with an optional right-aligned aside. */
export function SectionHeader({ index, title, aside, id }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-6 border-t border-rule pt-5">
      <SectionLabel index={index} as="h2" className="!text-muted">
        <span id={id}>{title}</span>
      </SectionLabel>
      {aside}
    </div>
  )
}
