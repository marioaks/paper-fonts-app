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

  // Add the dragging class to the element
  // Add is-dragged-over to prevent a css flicker
  ev.currentTarget.classList.add('is-dragging')
  ev.currentTarget.classList.add('is-dragged-over')
}

// Function to handle the end of a drag operation
// Useful for cases where the dragged element is dropped outside of a drop target
export function handleDragEnd(ev: React.DragEvent<HTMLDivElement>) {
  ev.preventDefault()

  // Remove the dragging classes when the drag ends
  ev.currentTarget.classList.remove('is-dragging')
  ev.currentTarget.classList.remove('is-dragged-over')
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
  ev.currentTarget.classList.add('is-dragged-over')
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
    ev.currentTarget.classList.add('is-dragged-over-top')
    ev.currentTarget.classList.remove('is-dragged-over-bottom')
  }
  else {
    ev.currentTarget.classList.add('is-dragged-over-bottom')
    ev.currentTarget.classList.remove('is-dragged-over-top')
  }
}

// Function to handle when a dragged element leaves a drop target
export function handleDragLeave(ev: React.DragEvent<HTMLDivElement>) {
  ev.preventDefault()

  // Remove is-dragged-over if the dragged element leaves the drop target
  if (!ev.currentTarget.contains(ev.relatedTarget as Node)) {
    ev.currentTarget.classList.remove('is-dragged-over')
    ev.currentTarget.classList.remove('is-dragged-over-top')
    ev.currentTarget.classList.remove('is-dragged-over-bottom')
  }
}

// Function to handle when a dragged element is dropped onto a target
export function handleDrop(ev: React.DragEvent<HTMLDivElement>) {
  ev.preventDefault()

  const draggedId = ev.dataTransfer.getData('text/plain')
  const draggedElement = document.getElementById(draggedId)
  if (ev.currentTarget.classList.contains('is-dragged-over-top'))
    ev.currentTarget?.before(draggedElement as Node)
  else
    ev.currentTarget?.after(draggedElement as Node)

  // Remove the dragging classes when the drag ends
  draggedElement?.classList.remove('is-dragging')
  ev.currentTarget.classList.remove('is-dragged-over')
  ev.currentTarget.classList.remove('is-dragged-over-top')
  ev.currentTarget.classList.remove('is-dragged-over-bottom')
}
