/**
 * ============================================
 * DRAGGED ELEMENT EVENT HANDLERS
 * Handlers for the element being dragged
 * ============================================
 */

// Function to handle the start of a drag operation
export function handleDragStart(ev: React.DragEvent<HTMLDivElement>) {
  // Save data to access in the drop event
  ev.dataTransfer.setData('text/plain', ev.currentTarget.id)
  ev.dataTransfer.effectAllowed = 'move'

  const draggedEl = ev.currentTarget
  const draggedElHeight = draggedEl.getBoundingClientRect().height

  // Add the dragging class to the element
  ev.currentTarget.classList.add('is-dragging')

  const list = ev.currentTarget.closest('.drag-and-drop-list') as HTMLElement
  const zoom = Number(document.documentElement.style.getPropertyValue('--card-zoom-size')) || 1
  list.style.setProperty('--dragged-height', `${draggedElHeight / zoom}px`)
}

// Function to handle the end of a drag operation
// Useful for cases where the dragged element is dropped outside of a drop target
export function handleDragEnd(ev: React.DragEvent<HTMLDivElement>) {
  ev.preventDefault()
  ev.currentTarget.classList.remove('is-dragging')
}

/**
 * ============================================
 * DROP TARGET EVENT HANDLERS
 * Handlers for the drop target
 * ============================================
 */

// Function to handle when a dragged element enters a drop target
export function handleDragEnter(ev: React.DragEvent<HTMLDivElement>) {
  ev.preventDefault()

  // Add is-dragged-over whenever a dragged element enters a drop target
  ev.currentTarget.classList.add('drop-target-hovered')
}

// Function to handle when a dragged element is over a drop target
// Called much more frequently than handleDragEnter
export function handleDragOver(ev: React.DragEvent<HTMLDivElement>) {
  ev.preventDefault()

  // As we're dragging over the current drop target,
  // we check if we're dragging over the top or bottom half
  // This will determine whether to drop the dragged element before or after the current drop target
  const rect = ev.currentTarget.getBoundingClientRect()
  const y = ev.clientY - rect.top
  const isTopHalf = y < rect.height / 2

  if (isTopHalf) {
    ev.currentTarget.classList.add('drop-target-hovered-top')
    ev.currentTarget.classList.remove('drop-target-hovered-bottom')
  }
  else {
    ev.currentTarget.classList.add('drop-target-hovered-bottom')
    ev.currentTarget.classList.remove('drop-target-hovered-top')
  }
}

// Function to handle when a dragged element leaves a drop target
export function handleDragLeave(ev: React.DragEvent<HTMLDivElement>) {
  ev.preventDefault()

  // Remove is-dragged-over if the dragged element leaves the drop target
  if (!ev.currentTarget.contains(ev.relatedTarget as Node)) {
    ev.currentTarget.classList.remove('drop-target-hovered')
    ev.currentTarget.classList.remove('drop-target-hovered-top')
    ev.currentTarget.classList.remove('drop-target-hovered-bottom')
    ev.currentTarget.removeAttribute('data-dragged-height')
  }
}

// Function to handle when a dragged element is dropped onto a target
export function handleDrop(ev: React.DragEvent<HTMLDivElement>) {
  ev.preventDefault()

  const draggedId = ev.dataTransfer.getData('text/plain')
  const list = ev.currentTarget.closest('.drag-and-drop-list') as HTMLElement
  const draggedElement = list.querySelector(`#${draggedId}`)

  if (ev.currentTarget.classList.contains('drop-target-hovered-top'))
    ev.currentTarget?.before(draggedElement as Node)
  else
    ev.currentTarget?.after(draggedElement as Node)

  // Remove the dragging classes when the drag ends
  draggedElement?.classList.remove('is-dragging')
  ev.currentTarget.classList.remove('drop-target-hovered')
  ev.currentTarget.classList.remove('drop-target-hovered-top')
  ev.currentTarget.classList.remove('drop-target-hovered-bottom')
}
