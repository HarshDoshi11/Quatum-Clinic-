import { AnimatePresence, MotionConfig } from 'motion/react'
import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { ToastProvider } from '@/components/ui/Toast'
import { CommandPalette } from '@/features/command/CommandPalette'
import { ExperimentDrawerProvider } from '@/features/experiments/ExperimentDrawer'
import { ShortcutsProvider } from '@/features/shortcuts/Shortcuts'
import { TourProvider } from '@/features/tour/Tour'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { Overview } from '@/pages/research/Overview'
import { PATIENT_ROUTES, RESEARCH_ROUTES, type RouteMeta } from '@/routes'
import { DataVersionProvider } from '@/state/dataVersion'
import { PlainLanguageProvider } from '@/state/plainLanguage'

// Chart pages are code-split (Recharts is large); the Overview stays in the main bundle.
const Data = lazy(() => import('@/pages/research/Data').then((m) => ({ default: m.Data })))
const Train = lazy(() => import('@/pages/research/Train').then((m) => ({ default: m.Train })))
const Advantage = lazy(() => import('@/pages/research/Advantage').then((m) => ({ default: m.Advantage })))
const SmallData = lazy(() => import('@/pages/research/SmallData').then((m) => ({ default: m.SmallData })))
const Scalability = lazy(() => import('@/pages/research/Scalability').then((m) => ({ default: m.Scalability })))
const Evolution = lazy(() => import('@/pages/research/Evolution').then((m) => ({ default: m.Evolution })))
const Hardware = lazy(() => import('@/pages/research/Hardware').then((m) => ({ default: m.Hardware })))
const Failure = lazy(() => import('@/pages/research/Failure').then((m) => ({ default: m.Failure })))

/** Shown for the instant a code-split page is loading: the page frame, no spinner. */
function PageFallback() {
  return (
    <div className="px-[var(--page-pad-x)] pt-14" aria-busy="true" aria-label="Loading page">
      <div className="h-4 w-48 bg-rule motion-safe:animate-pulse" />
      <div className="mt-8 h-20 w-3/4 max-w-[48rem] bg-rule motion-safe:animate-pulse" />
    </div>
  )
}

const lazyPage = (node: ReactNode) => <Suspense fallback={<PageFallback />}>{node}</Suspense>

/** Built pages; everything else renders a placeholder until its phase. */
function researchPage(route: RouteMeta) {
  switch (route.id) {
    case 'overview':
      return <Overview route={route} />
    case 'data':
      return lazyPage(<Data route={route} />)
    case 'train':
      return lazyPage(<Train route={route} />)
    case 'advantage':
      return lazyPage(<Advantage route={route} />)
    case 'small-data':
      return lazyPage(<SmallData route={route} />)
    case 'scalability':
      return lazyPage(<Scalability route={route} />)
    case 'evolution':
      return lazyPage(<Evolution route={route} />)
    case 'hardware':
      return lazyPage(<Hardware route={route} />)
    case 'failure':
      return lazyPage(<Failure route={route} />)
    default:
      return <PlaceholderPage route={route} />
  }
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        {RESEARCH_ROUTES.map((route) => (
          <Route key={route.id} path={route.path} element={researchPage(route)} />
        ))}
        {PATIENT_ROUTES.map((route) => (
          <Route key={route.id} path={route.path} element={<PlaceholderPage route={route} variant="patient" />} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}

export function App() {
  return (
    // reducedMotion="user": transform/layout animations are skipped when the OS asks for reduced motion.
    <MotionConfig reducedMotion="user">
      <DataVersionProvider>
        <PlainLanguageProvider>
          <ToastProvider>
            <ExperimentDrawerProvider>
              <TourProvider>
                <ShortcutsProvider>
                  <AppShell>
                    <AnimatedRoutes />
                  </AppShell>
                  <CommandPalette />
                </ShortcutsProvider>
              </TourProvider>
            </ExperimentDrawerProvider>
          </ToastProvider>
        </PlainLanguageProvider>
      </DataVersionProvider>
    </MotionConfig>
  )
}
