import { lazy, Suspense, useCallback, useRef } from 'react'

// three.js is large; load it only when the Overview renders.
const BlochSphere = lazy(() => import('./BlochSphere'))

function SphereFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
      <div className="aspect-square w-[62%] rounded-full border border-dashed border-rule-strong motion-safe:animate-pulse" />
    </div>
  )
}

/** Square Bloch-sphere viewport with a live θ/φ caption. */
export function BlochPanel() {
  const thetaRef = useRef<HTMLSpanElement>(null)
  const phiRef = useRef<HTMLSpanElement>(null)

  // Written straight to the DOM ~10×/s so the caption never re-renders the canvas.
  const onAngles = useCallback((theta: number, phi: number) => {
    if (thetaRef.current) thetaRef.current.textContent = theta.toFixed(2)
    if (phiRef.current) phiRef.current.textContent = phi.toFixed(2)
  }, [])

  return (
    <figure className="flex h-full flex-col">
      <div className="relative aspect-square w-full cursor-grab active:cursor-grabbing">
        <Suspense fallback={<SphereFallback />}>
          <BlochSphere onAngles={onAngles} />
        </Suspense>
      </div>
      <figcaption className="label-mono mt-2 text-center text-muted" aria-live="off">
        Drag to inspect · θ = <span ref={thetaRef} className="text-ink">1.12</span> · φ ={' '}
        <span ref={phiRef} className="text-ink">0.48</span>
      </figcaption>
    </figure>
  )
}
