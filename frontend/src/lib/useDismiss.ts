import { useEffect, type RefObject } from 'react'

/** Calls onDismiss on outside pointerdown or Escape while `active`. */
export function useDismiss(
  refs: ReadonlyArray<RefObject<HTMLElement | null>>,
  active: boolean,
  onDismiss: () => void,
): void {
  useEffect(() => {
    if (!active) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (refs.some((ref) => ref.current?.contains(target))) return
      onDismiss()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [refs, active, onDismiss])
}
