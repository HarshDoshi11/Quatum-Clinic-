import type { ReactNode } from 'react'
import type { RoadmapId } from './roadmap'

/** Wireframe primitives: grey hairline boxes and placeholder bars, nothing else. */
function Bar({ w, strong = false, tall = false }: { w: string; strong?: boolean; tall?: boolean }) {
  return <span className={`block shrink-0 rounded-full ${tall ? 'h-3' : 'h-2'} ${strong ? 'bg-rule-strong' : 'bg-rule'} ${w}`} />
}

function Box({ className = '', dashed = false, children }: { className?: string; dashed?: boolean; children?: ReactNode }) {
  return <div className={`rounded-control border border-rule-strong ${dashed ? 'border-dashed' : ''} ${className}`}>{children}</div>
}

function Screen({ children }: { children: ReactNode }) {
  return <div className="flex h-48 w-80 max-w-full shrink-0 flex-col gap-2.5 rounded-panel border border-rule-strong bg-bg p-4">{children}</div>
}

const Row = ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={`flex items-center gap-2 ${className}`}>{children}</div>

/** A small wireframe of each upcoming screen, shown when its build-log row opens. Decorative. */
export const WIREFRAMES: Record<RoadmapId, ReactNode> = {
  safety: (
    <Screen>
      <Bar w="w-2/3" strong tall />
      {['w-1/2', 'w-2/5', 'w-3/5'].map((w) => (
        <Box key={w} className="flex h-6 items-center px-2">
          <Bar w={w} />
        </Box>
      ))}
      <Row className="mt-auto">
        <Box className="h-8 flex-1" />
        <Box className="h-8 flex-1" />
      </Row>
    </Screen>
  ),
  oneQuestion: (
    <Screen>
      <div className="h-1 w-full rounded-full bg-rule">
        <div className="h-1 w-1/3 rounded-full bg-rule-strong" />
      </div>
      <Bar w="w-3/4" strong tall />
      <Bar w="w-1/2" />
      <Row className="mt-2">
        <Box className="h-10 w-24" />
        <Box className="h-10 w-24" dashed />
      </Row>
      <Row className="mt-auto">
        <Box className="h-7 w-16" />
        <Box className="h-7 w-16 bg-rule" />
      </Row>
    </Screen>
  ),
  honest: (
    <Screen>
      <Bar w="w-3/4" strong tall />
      <Row className="mt-1 gap-1.5">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="size-4 rounded-full border border-dashed border-rule-strong" />
        ))}
      </Row>
      <Box className="mt-auto flex flex-col gap-2 p-3">
        <Bar w="w-4/5" />
        <Bar w="w-3/5" />
      </Box>
    </Screen>
  ),
  finder: (
    <Screen>
      <Row>
        <Bar w="w-1/3" strong />
        <Bar w="ml-auto w-16" />
      </Row>
      <Box className="flex flex-1 flex-col justify-around px-2 py-1.5">
        {[false, false, true, false, false].map((on, i) => (
          <div key={i} className={`flex items-center justify-between rounded-sm px-1.5 py-1 ${on ? 'bg-rule ring-1 ring-rule-strong' : ''}`}>
            <Bar w={on ? 'w-1/3' : 'w-2/5'} strong={on} />
            <Bar w="w-8" strong={on} />
          </div>
        ))}
      </Box>
    </Screen>
  ),
  people: (
    <Screen>
      <Bar w="w-2/3" strong tall />
      <Row className="mt-2 gap-1.5">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="flex flex-col items-center gap-0.5">
            <span className="size-2.5 rounded-full border border-rule-strong" />
            <span className="h-3 w-4 rounded-t-full border border-rule-strong" />
          </span>
        ))}
      </Row>
      <Bar w="w-3/5" />
      <div className="mt-auto grid grid-cols-3 gap-1.5">
        <span className="h-1.5 rounded-full bg-rule-strong" />
        <span className="h-1.5 rounded-full bg-rule-strong" />
        <span className="h-1.5 rounded-full bg-rule" />
      </div>
    </Screen>
  ),
  visit: (
    <Screen>
      <Bar w="w-1/2" strong tall />
      <Row className="flex-1 items-start gap-4">
        <div className="flex flex-1 flex-col gap-2.5 pt-1">
          {['w-4/5', 'w-3/5', 'w-2/3'].map((w) => (
            <Row key={w}>
              <span className="size-3 shrink-0 rounded-sm border border-rule-strong" />
              <Bar w={w} />
            </Row>
          ))}
        </div>
        <Box className="grid w-24 grid-cols-5 gap-1 p-2">
          {Array.from({ length: 15 }, (_, i) => (
            <span key={i} className={`h-2 rounded-sm ${i === 8 ? 'bg-rule-strong' : 'bg-rule'}`} />
          ))}
        </Box>
      </Row>
      <Box className="h-7 w-28" />
    </Screen>
  ),
  family: (
    <Screen>
      <Box className="flex w-3/4 flex-col gap-2 p-3">
        <Bar w="w-full" />
        <Bar w="w-4/5" />
        <Bar w="w-1/2" />
      </Box>
      <Box className="ml-auto flex w-1/2 flex-col gap-2 p-3">
        <Bar w="w-full" />
        <Bar w="w-2/3" />
      </Box>
      <Row className="mt-auto">
        <Box className="h-7 flex-1" />
        <Box className="h-7 w-16" />
      </Row>
    </Screen>
  ),
  languages: (
    <Screen>
      <Row>
        <Box className="h-6 w-10 bg-rule" />
        <Box className="h-6 w-10" />
        <Box className="h-6 w-10" />
      </Row>
      <Bar w="w-3/4" strong tall />
      <Bar w="w-full" />
      <Bar w="w-4/5" />
      <Row className="mt-auto">
        <span className="size-8 rounded-full border border-rule-strong" />
        <Bar w="w-1/3" />
      </Row>
    </Screen>
  ),
}
