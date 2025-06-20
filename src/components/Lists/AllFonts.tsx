
import type { useFontFavorites } from '../../hooks/useFavorites'
import { useAllFontsLocalStorageSortOrder } from '../../hooks/useSortOrder'
import { DragAndDropList } from '../DragAndDrop/List'
import { FontFamilyCard } from '../FontFamilyCard'

type AllFontsProps = {
  fontFamilies: FontFamiliesDictionary
  favorites: Set<string>
  updateFavorites: ReturnType<typeof useFontFavorites>[1]
} & React.HTMLAttributes<HTMLDivElement>

export const AllFonts = ({ fontFamilies, favorites, updateFavorites, ...props }: AllFontsProps) => {
  const [sortOrder, saveNewOrder] = useAllFontsLocalStorageSortOrder(fontFamilies)

  return (
    <div {...props}>
      <DragAndDropList
        sortOrder={sortOrder}
        onDrop={saveNewOrder}
        renderItem={(familyId) => {
          return (
            <FontFamilyCard
              key={familyId}
              {...fontFamilies[familyId]}
              isFavorite={favorites.has(familyId)}
              updateFavorites={updateFavorites}
            />
          )
        }}
      />
    </div>
  )
}
