import type { useFontFavorites } from '../../hooks/useFavorites'
import { useFavoriteFontsLocalStorageSortOrder } from '../../hooks/useSortOrder'
import { DragAndDropList } from '../DragAndDrop/List'
import { FontFamilyCard } from '../FontFamilyCard'
import './index.css'

type FavoritesProps = {
  fontFamilies: FontFamiliesDictionary
  favorites: Set<string>
  updateFavorites: ReturnType<typeof useFontFavorites>[1]
} & React.HTMLAttributes<HTMLDivElement>

export const Favorites = ({ fontFamilies, favorites, updateFavorites, ...props }: FavoritesProps) => {
  const [sortOrder, saveNewOrder] = useFavoriteFontsLocalStorageSortOrder(fontFamilies, favorites)

  if (sortOrder?.length === 0) {
    return <p>No favorites yet. Add some to see them here.</p>
  }

  return (
    <div {...props} className="favorites-container">
      <DragAndDropList
        sortOrder={sortOrder}
        onDrop={saveNewOrder}
        renderItem={(familyId) => {
          return (
            <FontFamilyCard
              {...fontFamilies[familyId]}
              isFavorite={favorites.has(familyId)}
              updateFavorites={updateFavorites}
              updateFavoritesDelay={1500} // adds a delay, allowing users to change their mind before the favorite disappears
            />
          )
        }}
      />
    </div>
  )
}
