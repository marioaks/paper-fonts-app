import { useAllFontsSortOrder } from './hooks/useSortOrder'

export const AllFonts = ({ fontFamilies }: { fontFamilies: FontFamiliesDictionary }) => {
  const [sortOrder] = useAllFontsSortOrder(fontFamilies)

  return sortOrder?.map((family) => {
    // const fontFamily = fontFamilies[family]

    return (
      <div
        id={family}
        key={family}
        className="font-family"
        draggable
        onDragEnd={(ev) => {
          ev.preventDefault()
          ev.currentTarget.classList.remove('dragging')
        }}
        onDragStart={(ev) => {
          // Save data to access in the drop event
          ev.dataTransfer.setData('text/plain', ev.currentTarget.id)
          ev.dataTransfer.effectAllowed = 'move'

          // Add the dragging class to the element
          ev.currentTarget.classList.add('dragging')
          ev.currentTarget.classList.add('dragged-over')
        }}
        onDragOver={(ev) => {
          ev.preventDefault()
          // ev.dataTransfer.dropEffect = 'move'

          // As we're dragging over the current font family, we need to check if we're dragging over the top or bottom half
          // This will determine where to drop the font family
          const rect = ev.currentTarget.getBoundingClientRect()
          const y = ev.clientY - rect.top
          const isTopHalf = y < rect.height / 2

          //   const fontFamilyElementsPreceding = document.querySelectorAll('.font-family:has(~ .dragging):not(:has(~ .dragged-over)):not(.dragged-over-bottom)')
          //   console.log(fontFamilyElementsPreceding)

          if (isTopHalf) {
            ev.currentTarget.classList.add('dragged-over-top')
            ev.currentTarget.classList.remove('dragged-over-bottom')
          }
          else {
            ev.currentTarget.classList.add('dragged-over-bottom')
            ev.currentTarget.classList.remove('dragged-over-top')
          }
        }}
        onDragEnter={(ev) => {
          ev.preventDefault()

          if (!ev.currentTarget.classList.contains('dragged-over')) {
            ev.currentTarget.classList.add('dragged-over')
          }
        }}
        onDragLeave={(ev) => {
          ev.preventDefault()

          if (!ev.currentTarget.contains(ev.relatedTarget as Node)) {
            ev.currentTarget.classList.remove('dragged-over')
            ev.currentTarget.classList.remove('dragged-over-top')
            ev.currentTarget.classList.remove('dragged-over-bottom')
          }
        }}
        onDrop={(ev) => {
          ev.preventDefault()
          const draggedId = ev.dataTransfer.getData('text/plain')
          const draggedElement = document.getElementById(draggedId)
          if (ev.currentTarget.classList.contains('dragged-over-top'))
            ev.currentTarget?.before(draggedElement as Node)
          else
            ev.currentTarget?.after(draggedElement as Node)

          draggedElement?.classList.remove('dragging')
          ev.currentTarget.classList.remove('dragged-over')
          ev.currentTarget.classList.remove('dragged-over-top')
          ev.currentTarget.classList.remove('dragged-over-bottom')
        }}
      >
        <div>
          <h1 style={{ fontFamily: family }}>{family}</h1>
          {/* {fontFamily?.map(font => (
            <p key={font.postscriptName} style={{ fontFamily: font.postscriptName }}>{font.style}</p>
          ))} */}
        </div>
      </div>
    )
  })
}
