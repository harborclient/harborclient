import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CSSProperties } from 'react';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

interface SortableTabItemResult {
  /**
   * Ref for the sortable tab shell element.
   */
  setNodeRef: (element: HTMLElement | null) => void;

  /**
   * dnd-kit pointer and keyboard listeners for the tab shell.
   */
  listeners: SyntheticListenerMap | undefined;

  /**
   * Inline styles for transform and drag feedback on the tab shell.
   */
  style: CSSProperties;

  /**
   * Whether this tab is currently being dragged.
   */
  isDragging: boolean;
}

/**
 * Wraps dnd-kit sortable behavior for horizontal tab bar items while keeping
 * the tab element itself as a direct child of the tab list for ARIA compliance.
 *
 * @param id - Stable sortable id for this tab.
 * @param disabled - When true, skips drag behavior (for example a single open tab).
 * @returns Refs, listeners, and styles for the draggable tab shell.
 */
export function useSortableTabItem(id: string, disabled = false): SortableTabItemResult {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled
  });

  const style: CSSProperties = disabled
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : undefined
      };

  return {
    setNodeRef,
    listeners,
    style,
    isDragging
  };
}
