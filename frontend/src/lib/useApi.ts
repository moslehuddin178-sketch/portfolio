import { useCallback, useEffect, useState } from 'react'
import { ApiError, isApiConfigured } from './api'

export type ApiState<T> =
  | { status: 'unconfigured' }
  | { status: 'loading'; slow: boolean }
  | { status: 'success'; data: T }
  | { status: 'error'; error: ApiError }

/** After this long we tell the visitor the API is probably waking from scale-to-zero. */
const SLOW_AFTER_MS = 2500
/** Generous enough to cover a Container Apps cold start. */
const TIMEOUT_MS = 25000

/**
 * Calls `fetcher` once on mount and exposes a small state machine.
 * `fetcher` must be a stable reference (a module-level function).
 */
export function useApi<T>(fetcher: (signal: AbortSignal) => Promise<T>): ApiState<T> & { retry: () => void } {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<ApiState<T>>(() =>
    isApiConfigured() ? { status: 'loading', slow: false } : { status: 'unconfigured' },
  )

  useEffect(() => {
    if (!isApiConfigured()) {
      setState({ status: 'unconfigured' })
      return
    }
    const controller = new AbortController()
    let timedOut = false
    setState({ status: 'loading', slow: false })

    const slowTimer = setTimeout(() => setState({ status: 'loading', slow: true }), SLOW_AFTER_MS)
    const timeoutTimer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, TIMEOUT_MS)

    fetcher(controller.signal)
      .then((data) => setState({ status: 'success', data }))
      .catch((err: unknown) => {
        if (controller.signal.aborted && !timedOut) return // unmounted
        const error =
          err instanceof ApiError
            ? err
            : new ApiError(0, timedOut ? 'timeout' : 'unknown', timedOut ? 'The API took too long to respond.' : String(err))
        setState({ status: 'error', error })
      })
      .finally(() => {
        clearTimeout(slowTimer)
        clearTimeout(timeoutTimer)
      })

    return () => {
      clearTimeout(slowTimer)
      clearTimeout(timeoutTimer)
      controller.abort()
    }
  }, [fetcher, attempt])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])
  return { ...state, retry }
}
