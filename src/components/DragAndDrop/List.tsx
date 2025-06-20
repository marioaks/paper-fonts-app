import { forwardRef, useId } from 'react'
import { DragAndDropItem } from './Item'
import './index.css'

type Props = {
  sortOrder: string[]
  renderItem(item: string): React.ReactNode
  onDrop?(newSortOrder: string[]): void
}

export const DragAndDropList = forwardRef<HTMLDivElement, Props>(({ sortOrder, renderItem, onDrop }, ref) => {
  const listId = useId()
  return (
    <div
      id={listId}
      ref={ref}
      className="drag-and-drop-list"
      onDrop={(e) => {
        // Gets all elements from the DOM to get the new sort order
        // NOTE: If we were to virtualize this list, this wouldn't work
        const newSortOrder = Array.from(e.currentTarget.children).map(child => child.id)
        onDrop?.(newSortOrder)
      }}
    >
      {sortOrder.map((item) => {
        return (
          <DragAndDropItem
            key={`${listId}-${item}`}
            id={item}
          >
            {renderItem?.(item)}
          </DragAndDropItem>
        )
      })}
    </div>
  )
})
