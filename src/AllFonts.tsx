import { useAllFontsSortOrder } from './hooks/useSortOrder'

export const AllFonts = ({ fontFamilies }: { fontFamilies: FontFamiliesDictionary }) => {
  const [sortOrder] = useAllFontsSortOrder(fontFamilies)

  return sortOrder?.map((family) => {
    const fontFamily = fontFamilies[family]
    console.log(fontFamily)

    return (

      <div key={family}>
        <h1 style={{ fontFamily: family }}>{family}</h1>
        {/* {fontFamily?.map(font => (
          <p key={font.postscriptName} style={{ fontFamily: font.postscriptName }}>{font.style}</p>
        ))} */}
      </div>
    )
  })
}
