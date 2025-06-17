import { ALL_FONTS_SORT_ORDER_KEY, FAVORITE_FONTS_DICTIONARY_KEY, FAVORITE_FONTS_SORT_ORDER_KEY } from '../constants'
import { arrayToIndexLookup } from './arrayHelpers'

export const getFavoriteFontFamiliesFromLocalStorage = () => {
  const favoriteFontFamilies: FavoriteFontFamiliesDictionary = JSON.parse(localStorage.getItem(FAVORITE_FONTS_DICTIONARY_KEY) || '{}')
  return favoriteFontFamilies
}

export const saveFavoriteFontFamiliesToLocalStorage = (favoriteFontFamilies: FavoriteFontFamiliesDictionary) => {
  localStorage.setItem(FAVORITE_FONTS_DICTIONARY_KEY, JSON.stringify(favoriteFontFamilies))
}

export const getSavedSortOrderFromLocalStorage = (type: 'all' | 'favorites') => {
  const localStorageKey = type === 'all' ? ALL_FONTS_SORT_ORDER_KEY : FAVORITE_FONTS_SORT_ORDER_KEY
  const savedSortOrder: string[] = JSON.parse(localStorage.getItem(localStorageKey) || '[]')
  return arrayToIndexLookup(savedSortOrder)
}

export const saveSortOrderToLocalStorage = (type: 'all' | 'favorites', sortOrder: string[]) => {
  const localStorageKey = type === 'all' ? ALL_FONTS_SORT_ORDER_KEY : FAVORITE_FONTS_SORT_ORDER_KEY
  localStorage.setItem(localStorageKey, JSON.stringify(sortOrder))
}
