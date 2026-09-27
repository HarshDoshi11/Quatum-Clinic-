import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { tBase } from '@/lib/motion'
import { PATIENT_ROUTES, RESEARCH_ROUTES } from '@/routes'
import { useMode } from '@/state/mode'
import { Logo } from './Logo'
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

  return (
    <div
      className="grid h-full min-w-[1024px] overflow-hidden bg-bg text-ink"
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

      <div className="border-r border-b border-rule">
        <Logo mode={mode} />
      </div>
      <div className="border-b border-rule">
        <TopBar />
      </div>

      <aside className="relative overflow-hidden border-r border-rule">
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

      <main id="main" ref={mainRef} tabIndex={-1} className="relative overflow-y-auto overflow-x-hidden">
        {children}
      </main>

      <div className="col-span-2">
        <StatusStrip mode={mode} />
      </div>
    </div>
  )
}
