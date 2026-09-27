import { useCallback, useEffect, useState, type DependencyList } from 'react'
import { isAbortError } from './errors'

export type Resource<T> =
  | { status: 'loading'; data: undefined; error: undefined; reload: () => void }
  | { status: 'success'; data: T; error: undefined; reload: () => void }
  | { status: 'error'; data: undefined; error: Error; reload: () => void }

type State<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'success'; data: T; error: undefined }
  | { status: 'error'; data: undefined; error: Error }

const LOADING = { status: 'loading', data: undefined, error: undefined } as const

/**
 * Load data for a view. Refetches when `deps` change (e.g. the dataset),
 * aborts stale requests, and drops old data so a view never shows the
 * previous dataset's numbers while the next ones load.
 */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, deps: DependencyList): Resource<T> {
  const [state, setState] = useState<State<T>>(LOADING)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState(LOADING)
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data, error: undefined })
      },
      (error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return
        setState({ status: 'error', data: undefined, error: error instanceof Error ? error : new Error(String(error)) })
      },
    )
    return () => controller.abort()
    // `load` is intentionally excluded: callers pass an inline closure and control refetching via `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, reload }
}
