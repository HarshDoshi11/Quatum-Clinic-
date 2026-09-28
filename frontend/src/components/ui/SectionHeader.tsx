import type { ReactNode } from 'react'
import { PlainLine } from './PlainLine'
import { SectionLabel } from './SectionLabel'
import { Tooltip } from './Tooltip'

interface SectionHeaderProps {
  index: string
  title: ReactNode
  /** Required plain-language explanation, shown when Plain language is on. */
  plain: ReactNode
  /** Right-aligned slot, e.g. an ExperimentTag. */
  aside?: ReactNode
  id?: string
  /**
   * 'line' (default): "In simple words: …" under the label while Plain language is on.
   * 'popover': always behind a small "?" beside the label, for dense pages where lines would push results down.
   */
  plainAs?: 'line' | 'popover'
}

/** Hairline rule + "01 — TITLE" label, optional aside, and the plain-language line. */
export function SectionHeader({ index, title, plain, aside, id, plainAs = 'line' }: SectionHeaderProps) {
  return (
    <div className="border-t border-rule pt-5">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <SectionLabel index={index} as="h2" className="!text-muted">
            <span id={id}>{title}</span>
          </SectionLabel>
          {plainAs === 'popover' && <PlainHint>{plain}</PlainHint>}
        </div>
        {aside}
      </div>
      {plainAs === 'line' && <PlainLine>{plain}</PlainLine>}
    </div>
  )
}

/** Small "?" beside a label: the plain-language sentence on hover, focus or tap. */
export function PlainHint({ children }: { children: ReactNode }) {
  return (
    <Tooltip label="In simple words" content={children} width={280}>
      <button
        type="button"
        aria-label="In simple words"
        className="type-label inline-flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-[2px] border border-rule-strong text-muted hover:border-ink hover:text-ink"
      >
        ?
      </button>
    </Tooltip>
  )
}
