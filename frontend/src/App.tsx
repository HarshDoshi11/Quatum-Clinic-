import { AnimatePresence, MotionConfig } from 'motion/react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { ToastProvider } from '@/components/ui/Toast'
import { CommandPalette } from '@/features/command/CommandPalette'
import { ExperimentDrawerProvider } from '@/features/experiments/ExperimentDrawer'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { Overview } from '@/pages/research/Overview'
import { PATIENT_ROUTES, RESEARCH_ROUTES, type RouteMeta } from '@/routes'
import { DataVersionProvider } from '@/state/dataVersion'

/** Built pages; everything else renders a placeholder until its phase. */
function researchPage(route: RouteMeta) {
  switch (route.id) {
    case 'overview':
      return <Overview route={route} />
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
        <ToastProvider>
          <ExperimentDrawerProvider>
            <AppShell>
              <AnimatedRoutes />
            </AppShell>
            <CommandPalette />
          </ExperimentDrawerProvider>
        </ToastProvider>
      </DataVersionProvider>
    </MotionConfig>
  )
}
