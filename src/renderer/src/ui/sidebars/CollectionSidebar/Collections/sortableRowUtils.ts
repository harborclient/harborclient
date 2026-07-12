import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * Stops pointer events from bubbling to the sortable row drag activator.
 *
 * @param event - Pointer event from a nested interactive control.
 */
export function stopSortableDragPointerDown(event: ReactPointerEvent): void {
  event.stopPropagation();
}
