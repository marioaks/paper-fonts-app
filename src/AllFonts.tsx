import { DragAndDropList } from './components/DragAndDrop/List'
import { useAllFontsLocalStorageSortOrder } from './hooks/useSortOrder'

export const AllFonts = ({ fontFamilies }: { fontFamilies: FontFamiliesDictionary }) => {
  const [sortOrder, saveNewOrder] = useAllFontsLocalStorageSortOrder(fontFamilies)

  return (
    <DragAndDropList
      sortOrder={sortOrder}
      itemHeight={160}
      onDrop={saveNewOrder}
      renderItem={(family) => {
        return (
          <div className="font-family-card">
            <h1 style={{ fontFamily: family }}>{family}</h1>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem' }}>
              {fontFamilies[family]?.map(font => (
                <p key={font.postscriptName} style={{ fontFamily: font.postscriptName, whiteSpace: 'nowrap' }}>
                  {font.style}
                  {' '}
                  /
                </p>
              ))}
            </div>
          </div>
        )
      }}

    />
  )
}
