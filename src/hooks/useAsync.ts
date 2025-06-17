/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-expressions */

// This code was copied from the react-use library
// Original source: https://github.com/streamich/react-use/blob/master/src/useAsyncFn.ts

import { type DependencyList, useCallback, useEffect, useRef, useState } from 'react'

type PromiseType<P extends Promise<any>> = P extends Promise<infer T> ? T : never

type FunctionReturningPromise = (...args: any[]) => Promise<any>

type AsyncState<T> =
  | {
    loading: boolean
    error?: undefined
    value?: undefined
  }
  | {
    loading: true
    error?: Error | undefined
    value?: T
  }
  | {
    loading: false
    error: Error
    value?: undefined
  }
  | {
    loading: false
    error?: undefined
    value: T
  }

type StateFromFunctionReturningPromise<T extends FunctionReturningPromise> = AsyncState<
  PromiseType<ReturnType<T>>
>

export type AsyncFnReturn<T extends FunctionReturningPromise = FunctionReturningPromise> = [
  StateFromFunctionReturningPromise<T>,
  T,
]

export default function useAsyncFn<T extends FunctionReturningPromise>(
  fn: T,
  deps: DependencyList = [],
  initialState: StateFromFunctionReturningPromise<T> = { loading: false },
): AsyncFnReturn<T> {
  const lastCallId = useRef(0)
  const isMounted = useMountedState()
  const [state, set] = useState<StateFromFunctionReturningPromise<T>>(initialState)

  const callback = useCallback((...args: Parameters<T>): ReturnType<T> => {
    const callId = ++lastCallId.current

    if (!state.loading) {
      set(prevState => ({ ...prevState, loading: true }))
    }

    return fn(...args).then(
      (value) => {
        isMounted() && callId === lastCallId.current && set({ value, loading: false })

        return value
      },
      (error) => {
        isMounted() && callId === lastCallId.current && set({ error, loading: false })

        return error
      },
    ) as ReturnType<T>
  }, deps)

  return [state, callback as unknown as T]
}

function useMountedState(): () => boolean {
  const mountedRef = useRef<boolean>(false)
  const get = useCallback(() => mountedRef.current, [])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  return get
}
