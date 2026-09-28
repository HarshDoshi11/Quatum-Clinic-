import { motion } from 'motion/react'
import { Link, useLocation } from 'react-router-dom'
import { APP_VERSION } from '@/config'
import { easePrecise, springIndicator } from '@/lib/motion'
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
        className={`group relative flex items-center gap-2 py-1.5 pr-3 type-ui transition-colors duration-200 ${
          active ? 'text-ink' : 'text-muted hover:text-ink'
        }`}
      >
        <span className="relative flex h-6 w-6 shrink-0 items-center justify-start self-start" aria-hidden="true">
          {active && (
            <motion.span
              layoutId={markerId}
              transition={springIndicator}
              className="block h-[6px] w-[6px] bg-accent"
            />
          )}
        </span>
        <span className="min-w-0">{route.label}</span>
      </Link>
    </li>
  )
}

/**
 * Group numeral: ink, turning accent when the group holds the active page.
 * The accent copy is layered on top and crossfaded, so the change stays a
 * 200ms fade in both themes (and follows theme switches without re-animating).
 */
function GroupNumeral({ numeral, active }: { numeral: string; active: boolean }) {
  return (
    <span className="relative w-6 shrink-0 whitespace-nowrap">
      <motion.span
        className="block text-ink"
        initial={false}
        animate={{ opacity: active ? 0 : 1 }}
        transition={{ duration: 0.2, ease: easePrecise }}
      >
        {numeral}
      </motion.span>
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 text-accent"
        initial={false}
        animate={{ opacity: active ? 1 : 0 }}
        transition={{ duration: 0.2, ease: easePrecise }}
      >
        {numeral}
      </motion.span>
    </span>
  )
}

export function Sidebar({ mode }: { mode: Mode }) {
  const { pathname } = useLocation()

  return (
    <nav aria-label={mode === 'research' ? 'Research navigation' : 'Patient navigation'} className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-5 pt-8 pb-6">
        {mode === 'research' ? (
          <div className="flex flex-col gap-6">
            {RESEARCH_GROUPS.map((group, i) => {
              const groupActive = group.routes.some((route) => isActive(route, pathname))
              return (
                <div key={group.numeral} className={i > 0 ? 'border-t border-rule pt-5' : ''}>
                  {/* Numeral sits in the marker column so the title aligns with item labels. */}
                  <p className="type-label mb-2 flex gap-2 font-medium text-ink">
                    <GroupNumeral numeral={group.numeral} active={groupActive} />
                    <span>{group.title}</span>
                  </p>
                  <ul>
                    {group.routes.map((route) => (
                      <NavItem key={route.id} route={route} active={isActive(route, pathname)} markerId="nav-marker" />
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {PATIENT_ROUTES.filter((route) => !route.navParent).map((route) => (
              <NavItem
                key={route.id}
                route={route}
                // A flow page (the result) marks the page it belongs to.
                active={isActive(route, pathname) || PATIENT_ROUTES.some((r) => r.navParent === route.id && isActive(r, pathname))}
                markerId="patient-nav-marker"
              />
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-rule px-5 py-4">
        {mode === 'research' ? (
          <div className="flex items-center justify-between">
            <span className="type-label flex items-center gap-2 text-ink">
              <span className="block h-[6px] w-[6px] bg-ink" aria-hidden="true" />
              System nominal
            </span>
            <span className="type-label text-muted">v{APP_VERSION}</span>
          </div>
        ) : (
          <p className="type-small text-muted">Decision support, not a diagnosis.</p>
        )}
      </div>
    </nav>
  )
}
