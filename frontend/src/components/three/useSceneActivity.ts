import { useEffect, useRef, useState } from 'react'

/** Device-pixel-ratio range for every 3D canvas: sharp enough, and never more than 1.5× the pixels. */
export const SCENE_DPR: [number, number] = [1, 1.5]

/**
 * Whether a canvas should render: it is on screen and the tab is visible. Put the ref on the <Canvas> and use
 * `frameloop={active ? 'always' : 'never'}`, so off-screen or background scenes cost nothing.
 */
export function useSceneActivity<T extends HTMLElement = HTMLCanvasElement>() {
  const ref = useRef<T>(null)
  const [onScreen, setOnScreen] = useState(true)
  const [tabVisible, setTabVisible] = useState(() => typeof document === 'undefined' || document.visibilityState === 'visible')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const onChange = () => setTabVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  return { ref, active: onScreen && tabVisible }
}

/** Frees a memoized three.js geometry or material when it is replaced (e.g. a slider rebuilds it) or unmounted. */
export function useDisposable(resource: { dispose: () => void }) {
  useEffect(() => () => resource.dispose(), [resource])
}
