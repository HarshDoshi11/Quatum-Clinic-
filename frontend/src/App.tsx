import { AnimatePresence, MotionConfig } from 'motion/react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { PATIENT_ROUTES, RESEARCH_ROUTES } from '@/routes'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        {RESEARCH_ROUTES.map((route) => (
          <Route key={route.id} path={route.path} element={<PlaceholderPage route={route} />} />
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
      <AppShell>
        <AnimatedRoutes />
      </AppShell>
    </MotionConfig>
  )
}
