import type { ReactNode } from 'react'
import { GLOSSARY, type GlossaryKey } from '@/lib/glossary'
import { Tooltip } from './Tooltip'

interface TermProps {
  /** Glossary key; defaults to the lower-cased text. */
  term?: GlossaryKey
  children: ReactNode
}

/** Jargon with a dotted underline; hover or focus shows a one-line plain definition. */
export function Term({ term, children }: TermProps) {
  const key = (term ?? String(children).toLowerCase()) as GlossaryKey
  const entry = GLOSSARY[key]

  if (!entry) {
    if (import.meta.env.DEV) console.warn(`<Term>: no glossary entry for "${key}"`)
    return <>{children}</>
  }

  return (
    <Tooltip label={entry.name} content={entry.definition}>
      <span
        tabIndex={0}
        className="cursor-help underline decoration-muted decoration-dotted decoration-1 underline-offset-[3px] hover:decoration-ink"
      >
        {children}
      </span>
    </Tooltip>
  )
}
