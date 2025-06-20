import { useCallback, useRef } from 'react'

/**
 * A hook that returns a debounced version of a function
 * @param fn - The function to debounce
 * @param delay - The delay in milliseconds
 * @returns A debounced version of the function
 */
export function useDebounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const debouncedFn = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      fn(...args)
    }, delay)
  }, [fn, delay]) as T

  return debouncedFn
}
