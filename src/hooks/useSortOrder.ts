import { useCallback, useMemo } from 'react'
import { sortArrayByIndexLookup } from '../utils/arrayHelpers'
import { getSavedSortOrderFromLocalStorage, saveSortOrderToLocalStorage } from '../utils/localStorage'

export function useAllFontsLocalStorageSortOrder(fontFamilies: FontFamiliesDictionary) {
  return useFontSortOrderHelper('all', fontFamilies)
}

export function useFavoriteFontsLocalStorageSortOrder(fontFamilies: FontFamiliesDictionary, favorites: Set<string>) {
  const [sortedFontFamilies, updateSortOrder] = useFontSortOrderHelper('favorites', fontFamilies)

  const filteredSortedFontFamilies = useMemo(() => {
    return sortedFontFamilies.filter(family => favorites.has(family))
  }, [sortedFontFamilies, favorites])

  return [filteredSortedFontFamilies, updateSortOrder] as const
}

/**
 * Hook to manage the order of font families
 * Initializes the sort order from localStorage and make sure that it's up to date with the current local font list.
 *
 * @param key - The key to use for localStorage
 * @param fontFamilies - The font families from local-fonts API to sort
 * @returns A tuple containing the sorted array of font families and a function to update it in localStorage
 */
function useFontSortOrderHelper(type: 'all' | 'favorites', fontFamilies: FontFamiliesDictionary) {
  const updateSortOrder = useCallback((newSortOrder: string[]) => {
    saveSortOrderToLocalStorage(type, newSortOrder)
  }, [type])

  const sortedFontFamilies = useMemo(() => {
    if (!fontFamilies) return []

    const allFontFamilyKeys = Object.keys(fontFamilies)
    const sortOrderLookup = getSavedSortOrderFromLocalStorage(type)

    // Sort fonts from API based on saved order, putting unsaved fonts at the end
    const newReconciledSortOrder = sortArrayByIndexLookup(allFontFamilyKeys, sortOrderLookup, type === 'favorites')

    saveSortOrderToLocalStorage(type, newReconciledSortOrder)
    return newReconciledSortOrder
  }, [type, fontFamilies])

  return [sortedFontFamilies, updateSortOrder] as const
}
