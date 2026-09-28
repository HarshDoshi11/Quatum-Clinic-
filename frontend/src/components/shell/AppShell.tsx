import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { tBase } from '@/lib/motion'
import { PATIENT_ROUTES, RESEARCH_ROUTES } from '@/routes'
import { useMode } from '@/state/mode'
import { Logo } from './Logo'
import { PatientTopBar } from './PatientTopBar'
import { Sidebar } from './Sidebar'
import { StatusStrip } from './StatusStrip'
import { TopBar } from './TopBar'

/**
 * Fixed shell:
 *  ┌─────────┬──────────────────────┐
 *  │ logo    │ top bar              │
 *  ├─────────┼──────────────────────┤
 *  │ sidebar │ main (scrolls)       │
 *  ├─────────┴──────────────────────┤
 *  │ status strip                   │
 *  └────────────────────────────────┘
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { mode } = useMode()
  const { pathname } = useLocation()
  // Patient Mode's token layer is keyed on <html> so portalled panels follow it too. Set during render (an
  // idempotent DOM write) so children reading theme colours in this same render already see it.
  if (typeof document !== 'undefined' && document.documentElement.dataset.mode !== mode) document.documentElement.dataset.mode = mode
  const mainRef = useRef<HTMLElement>(null)

  // Each route starts at the top of the scroll container.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  // "Hardware Reality Lab — Q/Clinical"; the Overview keeps the product name.
  useEffect(() => {
    const route = [...RESEARCH_ROUTES, ...PATIENT_ROUTES].find((r) => r.path === pathname)
    document.title = !route || route.id === 'overview' ? 'Q/Clinical — Early Signal Lab' : `${route.label} — Q/Clinical`
  }, [pathname])

  // Patient Mode: a calm, separate app — minimal top bar, no sidebar, no status strip.
  if (mode === 'patient') {
    return (
      <div className="grid h-full min-w-0 overflow-hidden bg-bg text-ink print:block print:h-auto print:overflow-visible" style={{ gridTemplateRows: 'var(--topbar-h) minmax(0, 1fr)' }}>
        <a href="#main" className="type-small sr-only z-50 bg-ink px-3 py-2 text-bg focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
          Skip to content
        </a>
        <div className="print:hidden">
          <PatientTopBar />
        </div>
        <main id="main" ref={mainRef} tabIndex={-1} className="relative overflow-y-auto overflow-x-hidden print:overflow-visible">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div
      // Printing (Download PDF) keeps only the page content: no chrome, no scroll container.
      className="grid h-full min-w-[1024px] overflow-hidden bg-bg text-ink print:block print:h-auto print:min-w-0 print:overflow-visible"
      style={{
        gridTemplateColumns: 'var(--sidebar-w) minmax(0, 1fr)',
        gridTemplateRows: 'var(--topbar-h) minmax(0, 1fr) var(--strip-h)',
      }}
    >
      <a
        href="#main"
        className="type-label sr-only z-50 bg-ink px-3 py-2 text-bg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <div className="border-r border-b border-rule print:hidden">
        <Logo mode={mode} />
      </div>
      <div className="border-b border-rule print:hidden">
        <TopBar />
      </div>

      <aside className="relative overflow-hidden border-r border-rule print:hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            className="h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={tBase}
          >
            <Sidebar mode={mode} />
          </motion.div>
        </AnimatePresence>
      </aside>

      <main id="main" ref={mainRef} tabIndex={-1} className="relative overflow-y-auto overflow-x-hidden print:overflow-visible">
        {children}
      </main>

      <div className="col-span-2 print:hidden">
        <StatusStrip mode={mode} />
      </div>
    </div>
  )
}
