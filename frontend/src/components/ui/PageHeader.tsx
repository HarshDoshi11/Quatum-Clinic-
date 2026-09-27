import { useState, type ReactNode } from 'react'
import { PAGE_CONTENT } from '@/content/pages'
import type { RouteMeta } from '@/routes'
import { Drawer } from './Drawer'
import { Headline } from './Headline'
import { PlainLine } from './PlainLine'
import { SectionLabel } from './SectionLabel'

interface PageHeaderProps {
  route: RouteMeta
  /** Override the headline's size class (used by the Overview hero). */
  headlineClassName?: string
  /** Extra content under the headline (e.g. an experiment tag). */
  children?: ReactNode
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
export function PageHeader({ route, headlineClassName, children }: PageHeaderProps) {
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
            className="label-mono text-muted underline-offset-4 hover:text-ink hover:underline"
            aria-haspopup="dialog"
          >
            What is this? ↗
          </button>
        )}
      </div>
      <Headline
        size={headlineClassName ? 'custom' : 'lg'}
        className={`mt-6 ${headlineClassName ?? ''}`}
      >
        {route.headline}
      </Headline>
      {guide && <PlainLine className="mt-2">{guide.plain}</PlainLine>}
      {children}

      {guide && (
        <Drawer open={open} onClose={() => setOpen(false)} label={`What is this? ${route.label}`} width={460}>
          <div className="px-8 pt-8 pb-12">
            <p className="label-mono text-muted">What is this? · {route.section}</p>
            <p className="mt-4 font-serif text-[36px] leading-[1.05] text-ink">{route.label}</p>
            <p className="mt-4 text-[15px] leading-6 text-muted">{guide.plain}</p>
            <ol className="mt-10 border-t border-rule">
              {PARTS.map((part, i) => (
                <li key={part.key} className="border-b border-rule py-6">
                  <p className="label-mono text-muted">
                    <span className="text-ink">{String(i + 1).padStart(2, '0')}</span> — {part.title}
                  </p>
                  <p className="mt-3 text-[15px] leading-6 text-ink">{guide[part.key]}</p>
                </li>
              ))}
            </ol>
          </div>
        </Drawer>
      )}
    </div>
  )
}
