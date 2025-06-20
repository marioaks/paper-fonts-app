import { useEffect, useState } from 'react'
import useAsyncFn from './useAsync'

/**
 * Hook for accessing local fonts via the Local Font Access API.
 *
 * @returns A tuple containing:
 * 1. Font data object with:
 *    - loading: boolean
 *    - error: Error | null
 *    - data: Record<string (family name), FontFamily>
 *    - permissionStatus: PermissionState
 *    - hasBrowserSupport: boolean
 * 2. Function to trigger font fetching
 *
 * @note Font fetching must be triggered by user interaction (e.g. click) due to
 * browser security requirements around transient activation.
 */
export function useLoadLocalFonts() {
  // Check if the browser supports the Local Font Access API
  const hasBrowserSupport = 'queryLocalFonts' in window
  const permissionStatus = useCheckLocalFontPermissions()

  const [asyncData, fetchFonts] = useAsyncFn(async () => {
    // Likely unnecessary error checks, but just in case
    if (!window.queryLocalFonts) throw new Error('Local Font Access API is not supported in this browser')
    if (permissionStatus === 'denied') throw new Error('Local Font Access API permission denied. Please allow access to local fonts.')

    // Fetch available fonts and group them by family
    const availableFonts = await window.queryLocalFonts()

    // Group fonts by family
    return availableFonts.reduce<FontFamiliesDictionary>((acc, font) => {
      // Create a unique ID for the family by replacing spaces with hyphens
      const familyId = font.family.toLowerCase().replace(/\s+/g, '-')
      const currentFamily = acc[familyId]
      return {
        ...acc,
        [familyId]: {
          id: familyId,
          fullName: font.family,
          styles: [...(currentFamily?.styles || []), font],
        },
      }
    }, {} as FontFamiliesDictionary)
  }, [permissionStatus])

  return [{ ...asyncData, permissionStatus, hasBrowserSupport }, fetchFonts] as const
}

/**
 * A custom hook that checks the permission status for accessing local fonts.
 * @returns {PermissionState} The current permission state ('granted', 'denied', or 'prompt').
 */
function useCheckLocalFontPermissions() {
  const [status, setStatus] = useState<PermissionStatus | null>(null)

  useEffect(() => {
    const promptUserForPermission = async () => {
      // Query the permission status for local fonts
      const permissionStatus = await navigator.permissions.query({ name: 'local-fonts' as PermissionName })
      setStatus(permissionStatus)

      // Listen for changes in the permission status
      permissionStatus.onchange = () => {
        setStatus(permissionStatus)
      }
    }

    promptUserForPermission()
  }, [])

  return status?.state ?? 'prompt'
}
