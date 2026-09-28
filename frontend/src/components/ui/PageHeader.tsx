import { useState, type ReactNode } from 'react'
import { PAGE_CONTENT } from '@/content/pages'
import type { RouteMeta } from '@/routes'
import { Drawer } from './Drawer'
import { Headline } from './Headline'
import { CompactPlainLine, PlainLine } from './PlainLine'
import { SectionLabel } from './SectionLabel'

interface PageHeaderProps {
  route: RouteMeta
  /** Override the headline's size class (used by the Overview hero). */
  headlineClassName?: string
  /** Extra content under the headline (e.g. an experiment tag); right-aligned beside it when compact. */
  children?: ReactNode
  /**
   * Compact (dense tool pages): the headline at type-h2 on one line with `children` on the same row, and
   * the plain-language line (when the toggle is on) one line long beside "What is this?", so the header stays under ~120px.
   */
  compact?: boolean
}

const PARTS = [
  { key: 'shows', title: 'What this page shows' },
  { key: 'matters', title: 'Why it matters' },
  { key: 'read', title: 'How to read it' },
] as const

/**
 * Section label + question headline + "What is this? ↗" + plain-language line.
 * Every page uses it so the beginner layer is never forgotten (see CLAUDE.md).
 */
export function PageHeader({ route, headlineClassName, children, compact = false }: PageHeaderProps) {
  const [open, setOpen] = useState(false)
  const guide = PAGE_CONTENT[route.id as keyof typeof PAGE_CONTENT]

  return (
    <div data-tour="headline">
      <div className="flex items-center gap-5">
        <SectionLabel>{route.section}</SectionLabel>
        {guide && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="type-label text-muted underline-offset-4 hover:text-ink hover:underline print:hidden"
            aria-haspopup="dialog"
          >
            What is this? ↗
          </button>
        )}
        {/* Compact pages keep the plain-language line in this row, so the toggle never pushes results down */}
        {compact && guide && <CompactPlainLine className="min-w-0 flex-1 [&>span]:pt-0">{guide.plain}</CompactPlainLine>}
      </div>
      {compact ? (
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <Headline size="custom" className="type-h2 whitespace-nowrap">
            {route.headline}
          </Headline>
          {children}
        </div>
      ) : (
        <>
          <Headline size={headlineClassName ? 'custom' : 'display'} className={`mt-6 ${headlineClassName ?? ''}`}>
            {route.headline}
          </Headline>
          {guide && <PlainLine className="mt-2">{guide.plain}</PlainLine>}
          {children}
        </>
      )}

      {guide && (
        <Drawer open={open} onClose={() => setOpen(false)} label={`What is this? ${route.label}`} width={500}>
          <div className="px-8 pt-8 pb-12">
            <p className="type-label text-muted">What is this? · {route.section}</p>
            <p className="mt-4 type-h2 text-ink">{route.label}</p>
            <p className="mt-4 type-body text-muted">{guide.plain}</p>
            <ol className="mt-10 border-t border-rule">
              {PARTS.map((part, i) => (
                <li key={part.key} className="border-b border-rule py-6">
                  <p className="type-label text-muted">
                    <span className="text-ink">{String(i + 1).padStart(2, '0')}</span> — {part.title}
                  </p>
                  <p className="mt-3 type-body text-ink">{guide[part.key]}</p>
                </li>
              ))}
            </ol>
          </div>
        </Drawer>
      )}
    </div>
  )
}
