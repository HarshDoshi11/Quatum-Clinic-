import { motion } from 'motion/react'
import { Link, useLocation } from 'react-router-dom'
import { APP_VERSION } from '@/config'
import { springIndicator } from '@/lib/motion'
import { PATIENT_ROUTES, RESEARCH_GROUPS, type RouteMeta } from '@/routes'
import type { Mode } from '@/state/mode'

function isActive(route: RouteMeta, pathname: string): boolean {
  // Exact match; tolerate a trailing slash.
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return normalized === route.path
}

function NavItem({ route, active, markerId }: { route: RouteMeta; active: boolean; markerId: string }) {
  return (
    <li>
      <Link
        to={route.path}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex items-center gap-2 py-[5px] pr-3 text-[13.5px] leading-5 transition-colors duration-200 ${
          active ? 'text-ink' : 'text-muted hover:text-ink'
        }`}
      >
        <span className="relative flex h-5 w-6 shrink-0 items-center justify-start" aria-hidden="true">
          {active && (
            <motion.span
              layoutId={markerId}
              transition={springIndicator}
              className="block h-[6px] w-[6px] bg-accent"
            />
          )}
        </span>
        <span className="truncate">{route.label}</span>
      </Link>
    </li>
  )
}

export function Sidebar({ mode }: { mode: Mode }) {
  const { pathname } = useLocation()

  return (
    <nav aria-label={mode === 'research' ? 'Research navigation' : 'Patient navigation'} className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-5 pt-8 pb-6">
        {mode === 'research' ? (
          <div className="flex flex-col gap-7">
            {RESEARCH_GROUPS.map((group) => (
              <div key={group.numeral}>
                {/* Numeral sits in the marker column so the title aligns with item labels. */}
                <p className="label-mono mb-2 flex gap-2 text-[10.5px] tracking-[0.06em] text-muted">
                  <span className="w-6 shrink-0 whitespace-nowrap text-ink">{group.numeral}</span>
                  <span>{group.title}</span>
                </p>
                <ul>
                  {group.routes.map((route) => (
                    <NavItem key={route.id} route={route} active={isActive(route, pathname)} markerId="nav-marker" />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {PATIENT_ROUTES.map((route) => (
              <NavItem key={route.id} route={route} active={isActive(route, pathname)} markerId="patient-nav-marker" />
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-rule px-5 py-4">
        {mode === 'research' ? (
          <div className="flex items-center justify-between">
            <span className="label-mono flex items-center gap-2 text-ink">
              <span className="block h-[6px] w-[6px] bg-risk-low" aria-hidden="true" />
              System nominal
            </span>
            <span className="label-mono text-muted">v{APP_VERSION}</span>
          </div>
        ) : (
          <p className="text-[13px] leading-5 text-muted">Decision support, not a diagnosis.</p>
        )}
      </div>
    </nav>
  )
}
