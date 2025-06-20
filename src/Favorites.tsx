import { DragAndDropList } from './components/DragAndDrop/List'
import { FontFamilyCard } from './components/FontFamilyCard'
import { useFavoriteFontsLocalStorageSortOrder } from './hooks/useSortOrder'

type FavoritesProps = {
  fontFamilies: FontFamiliesDictionary
  favorites: Set<string>
  toggleFavorite: (family: string) => void
} & React.HTMLAttributes<HTMLDivElement>

export const Favorites = ({ fontFamilies, favorites, toggleFavorite, ...props }: FavoritesProps) => {
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
              name={fontFamilies[familyId].fullName}
              fontStyles={fontFamilies[familyId].styles}
              isFavorited={favorites.has(familyId)}
              onFavoriteClick={() => toggleFavorite(familyId)}
            />
          )
        }}
      />
    </div>
  )
}
