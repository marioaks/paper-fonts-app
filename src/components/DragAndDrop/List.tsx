import { DragAndDropItem } from './Item'

type Props = {
  sortOrder: string[]
  itemHeight: number
  renderItem(item: string): React.ReactNode
  onDrop?(newSortOrder: string[]): void
}

export const DragAndDropList = ({ sortOrder, renderItem, itemHeight = 100, onDrop }: Props) => {
  return (
    <div
      className="drag-and-drop-list"
      onDrop={(e) => {
        const newSortOrder = Array.from(e.currentTarget.children).map(child => child.id)
        onDrop?.(newSortOrder)
      }}
    >
      {sortOrder.map((item) => {
        return (
          <DragAndDropItem
            key={item}
            id={item}
            height={itemHeight}
          >
            {renderItem?.(item)}
          </DragAndDropItem>
        )
      })}
    </div>
  )
}
