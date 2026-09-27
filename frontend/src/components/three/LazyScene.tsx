import { lazy, Suspense, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'

/**
 * Rule (CLAUDE.md): every React Three Fiber scene is code-split with
 * `lazyScene(() => import('./MyScene'))` and rendered inside <SceneFrame>,
 * so pages paint instantly and three.js loads only when a 3D view is shown.
 */
export function lazyScene<P extends object>(load: () => Promise<{ default: ComponentType<P> }>): LazyExoticComponent<ComponentType<P>> {
  return lazy(load)
}

/** Minimal placeholder while a scene's code loads: a dashed hairline frame and a mono label. */
export function SceneSkeleton({ label = 'Loading 3D view', shape = 'circle' }: { label?: string; shape?: 'circle' | 'rect' }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <div
        className={`border border-dashed border-rule-strong motion-safe:animate-pulse ${
          shape === 'circle' ? 'aspect-square w-[62%] rounded-full' : 'h-[70%] w-[85%] rounded-[2px]'
        }`}
        aria-hidden="true"
      />
      <span className="type-label text-muted">{label}</span>
    </div>
  )
}

/** Suspense boundary with the standard scene skeleton. */
export function SceneFrame({ children, label, shape }: { children: ReactNode; label?: string; shape?: 'circle' | 'rect' }) {
  return <Suspense fallback={<SceneSkeleton label={label} shape={shape} />}>{children}</Suspense>
}
