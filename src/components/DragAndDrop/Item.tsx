import * as helpers from './helpers'
import './index.css'

/**
 * DragAndDropItem Component
 *
 * A reusable component that implements drag and drop functionality via the HTML5 drag and drop API.
 * It acts as both a draggable element and a drop target, allowing items to be reordered within a list or container.
 */

type Props = {
  id: string
}

export const DragAndDropItem = ({
  id,
  children,
  ...props
}: React.PropsWithChildren<Props>) => {
  return (
    <div
      id={id}
      draggable
      className="draggable-item"

      // Draggable element events
      onDragStart={helpers.handleDragStart}
      onDragEnd={helpers.handleDragEnd}

      // Drop target events
      onDragEnter={helpers.handleDragEnter}
      onDragOver={helpers.handleDragOver}
      onDragLeave={helpers.handleDragLeave}
      onDrop={helpers.handleDrop}
      {...props}
    >
      <div className="draggable-item-content">
        {children}
      </div>
    </div>
  )
}
