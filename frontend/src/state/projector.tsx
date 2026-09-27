import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { readStored, writeStored } from '@/lib/storage'

const STORAGE_KEY = 'qc.projector'
const VALUES = ['on', 'off'] as const

interface ProjectorValue {
  /** 115% root size + boosted contrast, for presenting on a projector. */
  projector: boolean
  setProjector: (on: boolean) => void
  toggleProjector: () => void
}

const ProjectorContext = createContext<ProjectorValue | null>(null)

/** Applied synchronously (like the theme) so canvas colours read the right CSS variables on the next render. */
function apply(on: boolean): void {
  if (on) document.documentElement.dataset.projector = 'on'
  else delete document.documentElement.dataset.projector
}

export function ProjectorProvider({ children }: { children: ReactNode }) {
  // index.html already applied the stored value before first paint.
  const [projector, setState] = useState(() => readStored(STORAGE_KEY, VALUES) === 'on')
  const ref = useRef(projector)
  ref.current = projector

  const setProjector = useCallback((on: boolean) => {
    apply(on)
    writeStored(STORAGE_KEY, on ? 'on' : 'off')
    setState(on)
  }, [])

  const toggleProjector = useCallback(() => setProjector(!ref.current), [setProjector])

  const value = useMemo(() => ({ projector, setProjector, toggleProjector }), [projector, setProjector, toggleProjector])
  return <ProjectorContext.Provider value={value}>{children}</ProjectorContext.Provider>
}

export function useProjector(): ProjectorValue {
  const ctx = useContext(ProjectorContext)
  if (!ctx) throw new Error('useProjector must be used inside <ProjectorProvider>')
  return ctx
}
