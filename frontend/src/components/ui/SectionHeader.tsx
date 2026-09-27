import type { ReactNode } from 'react'
import { PlainLine } from './PlainLine'
import { SectionLabel } from './SectionLabel'

interface SectionHeaderProps {
  index: string
  title: ReactNode
  /** Required plain-language explanation, shown when Plain language is on. */
  plain: ReactNode
  /** Right-aligned slot, e.g. an ExperimentTag. */
  aside?: ReactNode
  id?: string
}

/** Hairline rule + "01 — TITLE" label, optional aside, and the plain-language line. */
export function SectionHeader({ index, title, plain, aside, id }: SectionHeaderProps) {
  return (
    <div className="border-t border-rule pt-5">
      <div className="flex items-center justify-between gap-6">
        <SectionLabel index={index} as="h2" className="!text-muted">
          <span id={id}>{title}</span>
        </SectionLabel>
        {aside}
      </div>
      <PlainLine>{plain}</PlainLine>
    </div>
  )
}
