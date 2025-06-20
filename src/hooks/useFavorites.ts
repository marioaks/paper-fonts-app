/**
 * Hook to manage font favorites in localStorage.
 * Returns a record of favorite fonts and a function to toggle a font's favorite status.
 */

import { useCallback, useState } from 'react'
import { getFavoriteFontFamiliesFromLocalStorage, saveFavoriteFontFamiliesToLocalStorage } from '../utils/localStorage'

export function useFontFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(
    getFavoriteFontFamiliesFromLocalStorage(),
  )

  const toggleFavorite = useCallback((family: string) => {
    setFavorites((prev) => {
      const newState = new Set(prev)
      if (prev.has(family)) {
        newState.delete(family)
      }
      else {
        newState.add(family)
      }
      saveFavoriteFontFamiliesToLocalStorage(newState)
      return newState
    })
  }, [])

  return [favorites, toggleFavorite] as const
}

// TODO MAKE THIS A USEREDUCER WITH A TOGGLE FAVORITE AND A RESORT FUNCTION!!
// export function useFontFavorites() {
//   const [favorites, setFavorites] = useState<Record<string, boolean>>(
//     JSON.parse(localStorage.getItem(FONT_FAVORITES_DICTIONARY_KEY) || '{}'),
//   )

//   const toggleFavorite = useCallback((family: string) => {
//     setFavorites((prev) => {
//       const newState = { ...prev, [family]: !prev[family] }
//       localStorage.setItem(FONT_FAVORITES_DICTIONARY_KEY, JSON.stringify(newState))
//       setFavorites(newState)

//       const [favoritesOrder, setFavoritesOrder] = useFavoritesFontsSortOrder()

//       // Debounce the order update to avoid too many localStorage writes
//       const updateOrder = useCallback(
//         debounce((family: string, isFavorite: boolean) => {
//           if (isFavorite) {
//             // Add to favorites order if not already present
//             if (!favoritesOrder.includes(family)) {
//               setFavoritesOrder([...favoritesOrder, family])
//             }
//           }
//           else {
//             // Remove from favorites order
//             setFavoritesOrder(favoritesOrder.filter(f => f !== family))
//           }
//         }, 300),
//         [favoritesOrder, setFavoritesOrder],
//       )

//       updateOrder(family, !prev[family])
//       return newState
//     })
//   }, [])

//   return [favorites, toggleFavorite] as const
// }
