/**
 * Hook to manage font favorites in localStorage.
 * Returns a record of favorite fonts and a function to add or remove a font from the favorites.
 */

import { useReducer } from 'react'
import { getFavoriteFontFamiliesFromLocalStorage, saveFavoriteFontFamiliesToLocalStorage } from '../utils/localStorage'

type FavoriteAction =
  | { type: 'FAVORITE', payload: string }
  | { type: 'UNFAVORITE', payload: string }

function favoritesReducer(state: Set<string>, action: FavoriteAction): Set<string> {
  switch (action.type) {
    case 'FAVORITE': {
      const newState = new Set(state)
      newState.add(action.payload)
      saveFavoriteFontFamiliesToLocalStorage(newState)
      return newState
    }
    case 'UNFAVORITE': {
      const newState = new Set(state)
      newState.delete(action.payload)
      saveFavoriteFontFamiliesToLocalStorage(newState)
      return newState
    }
    default:
      return state
  }
}

export function useFontFavorites() {
  return useReducer(
    favoritesReducer,
    getFavoriteFontFamiliesFromLocalStorage(),
  )
}
