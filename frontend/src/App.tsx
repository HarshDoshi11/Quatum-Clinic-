import { AnimatePresence, MotionConfig } from 'motion/react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { ToastProvider } from '@/components/ui/Toast'
import { CommandPalette } from '@/features/command/CommandPalette'
import { ExperimentDrawerProvider } from '@/features/experiments/ExperimentDrawer'
import { ShortcutsProvider } from '@/features/shortcuts/Shortcuts'
import { TourProvider } from '@/features/tour/Tour'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { Advantage } from '@/pages/research/Advantage'
import { Data } from '@/pages/research/Data'
import { Evolution } from '@/pages/research/Evolution'
import { Overview } from '@/pages/research/Overview'
import { Scalability } from '@/pages/research/Scalability'
import { SmallData } from '@/pages/research/SmallData'
import { Train } from '@/pages/research/Train'
import { PATIENT_ROUTES, RESEARCH_ROUTES, type RouteMeta } from '@/routes'
import { DataVersionProvider } from '@/state/dataVersion'
import { PlainLanguageProvider } from '@/state/plainLanguage'

/** Built pages; everything else renders a placeholder until its phase. */
function researchPage(route: RouteMeta) {
  switch (route.id) {
    case 'overview':
      return <Overview route={route} />
    case 'data':
      return <Data route={route} />
    case 'train':
      return <Train route={route} />
    case 'advantage':
      return <Advantage route={route} />
    case 'small-data':
      return <SmallData route={route} />
    case 'scalability':
      return <Scalability route={route} />
    case 'evolution':
      return <Evolution route={route} />
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
