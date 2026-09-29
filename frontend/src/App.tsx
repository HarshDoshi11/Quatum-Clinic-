import { AnimatePresence, MotionConfig } from 'motion/react'
import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { ToastProvider } from '@/components/ui/Toast'
import { CommandPalette } from '@/features/command/CommandPalette'
import { ExperimentDrawerProvider } from '@/features/experiments/ExperimentDrawer'
import { ShortcutsProvider } from '@/features/shortcuts/Shortcuts'
import { TourProvider } from '@/features/tour/Tour'
import { LIVE_PATIENT_ROUTES, PATIENT_BASE, PATIENT_MODE_ENABLED, RESEARCH_ROUTES, type PatientRouteId, type ResearchRouteId, type RouteMeta } from '@/routes'
import { DataVersionProvider } from '@/state/dataVersion'
import { PageBackendProvider } from '@/state/pageBackend'
import { PatientProvider } from '@/state/patient'
import { PlainLanguageProvider } from '@/state/plainLanguage'

// Every page is code-split, so the shell paints first and each page loads only when visited.
const Overview = lazy(() => import('@/pages/research/Overview').then((m) => ({ default: m.Overview })))
const Data = lazy(() => import('@/pages/research/Data').then((m) => ({ default: m.Data })))
const Train = lazy(() => import('@/pages/research/Train').then((m) => ({ default: m.Train })))
const Advantage = lazy(() => import('@/pages/research/Advantage').then((m) => ({ default: m.Advantage })))
const SmallData = lazy(() => import('@/pages/research/SmallData').then((m) => ({ default: m.SmallData })))
const Scalability = lazy(() => import('@/pages/research/Scalability').then((m) => ({ default: m.Scalability })))
const Evolution = lazy(() => import('@/pages/research/Evolution').then((m) => ({ default: m.Evolution })))
const Hardware = lazy(() => import('@/pages/research/Hardware').then((m) => ({ default: m.Hardware })))
const Explain = lazy(() => import('@/pages/research/Explain').then((m) => ({ default: m.Explain })))
const Predict = lazy(() => import('@/pages/research/Predict').then((m) => ({ default: m.Predict })))
const CrossModality = lazy(() => import('@/pages/research/CrossModality').then((m) => ({ default: m.CrossModality })))
const Report = lazy(() => import('@/pages/research/Report').then((m) => ({ default: m.Report })))
const Failure = lazy(() => import('@/pages/research/Failure').then((m) => ({ default: m.Failure })))
const PatientHome = lazy(() => import('@/pages/patient/Home').then((m) => ({ default: m.PatientHome })))
const Assessment = lazy(() => import('@/pages/patient/Assessment').then((m) => ({ default: m.Assessment })))
const MyReport = lazy(() => import('@/pages/patient/MyReport').then((m) => ({ default: m.MyReport })))
const ComingSoon = lazy(() => import('@/pages/patient/ComingSoon').then((m) => ({ default: m.ComingSoon })))

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

/** Research pages, one per route id (exhaustive: a new id without a page fails to compile). */
function researchPage(route: RouteMeta<ResearchRouteId>) {
  switch (route.id) {
    case 'overview':
      return lazyPage(<Overview route={route} />)
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
    case 'predict':
      return lazyPage(<Predict route={route} />)
    case 'cross-modality':
      return lazyPage(<CrossModality route={route} />)
    case 'report':
      return lazyPage(<Report route={route} />)
    case 'explain':
      return lazyPage(<Explain route={route} />)
    default: {
      const unhandled: never = route.id
      throw new Error(`No page for route ${String(unhandled)}`)
    }
  }
}

/** Patient Mode pages (exhaustive, like the research pages). */
function patientPage(route: RouteMeta<PatientRouteId>) {
  switch (route.id) {
    case 'patient-home':
      return lazyPage(<PatientHome route={route} />)
    case 'patient-assessment':
      return lazyPage(<Assessment route={route} />)
    case 'patient-report':
      return lazyPage(<MyReport route={route} />)
    case 'patient-soon':
      return lazyPage(<ComingSoon route={route} />)
    default: {
      const unhandled: never = route.id
      throw new Error(`No page for route ${String(unhandled)}`)
    }
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
        {LIVE_PATIENT_ROUTES.map((route) => (
          <Route key={route.id} path={route.path} element={patientPage(route)} />
        ))}
        {/* While Patient Mode is a teaser, its other addresses lead to it. */}
        {!PATIENT_MODE_ENABLED && <Route path={`${PATIENT_BASE}/*`} element={<Navigate to={PATIENT_BASE} replace />} />}
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
        <PatientProvider>
          <PlainLanguageProvider>
            <ToastProvider>
              <ExperimentDrawerProvider>
                <TourProvider>
                  <ShortcutsProvider>
                    <PageBackendProvider>
                      <AppShell>
                        <AnimatedRoutes />
                      </AppShell>
                    </PageBackendProvider>
                    <CommandPalette />
                  </ShortcutsProvider>
                </TourProvider>
              </ExperimentDrawerProvider>
            </ToastProvider>
          </PlainLanguageProvider>
        </PatientProvider>
      </DataVersionProvider>
    </MotionConfig>
  )
}
