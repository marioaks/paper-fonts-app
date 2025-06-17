import { useCallback, useEffect, useState } from 'react'
import { sortArrayByIndexLookup } from '../utils/arrayHelpers'
import { getFavoriteFontFamiliesFromLocalStorage, getSavedSortOrderFromLocalStorage, saveSortOrderToLocalStorage } from '../utils/localStorage'

/**
 * Hook to manage the order of font families in localStorage.
 * Initializes the sort order from localStorage and updates it with the current local font list.
 *
 * @param key - The key to use for localStorage
 * @param fontFamilies - The font families from local-fonts API to sort
 * @returns A tuple containing the current order array and a function to update it
 */
function useFontSortOrderHelper(type: 'all' | 'favorites', fontFamilies: FontFamiliesDictionary) {
  const [sortOrder, _updateOrder] = useState<string[]>()

  useEffect(() => {
    if (!fontFamilies) return

    const allFontFamilyKeys = Object.keys(fontFamilies)
    const sortOrderLookup = getSavedSortOrderFromLocalStorage(type)

    // Sort current fonts based on saved order, putting unsaved fonts at the end
    let newReconciledSortOrder = sortArrayByIndexLookup(allFontFamilyKeys, sortOrderLookup)

    // For favorites, only include fonts that are actually favorited
    if (type === 'favorites') {
      const favoriteFontFamilies = getFavoriteFontFamiliesFromLocalStorage()
      newReconciledSortOrder = newReconciledSortOrder.filter(family => favoriteFontFamilies[family])
    }

    _updateOrder(newReconciledSortOrder)
  }, [type, fontFamilies])

  // Update both localStorage and state with new order
  const updateOrderWithLocalStorage = useCallback((newOrder: string[]) => {
    saveSortOrderToLocalStorage(type, newOrder)
    _updateOrder(newOrder)
    return newOrder
  }, [type])

  return [sortOrder, updateOrderWithLocalStorage] as const
}

export function useAllFontsSortOrder(fontFamilies: FontFamiliesDictionary) {
  return useFontSortOrderHelper('all', fontFamilies)
}

export function useFavoritesFontsSortOrder(fontFamilies: FontFamiliesDictionary) {
  return useFontSortOrderHelper('favorites', fontFamilies)
}
