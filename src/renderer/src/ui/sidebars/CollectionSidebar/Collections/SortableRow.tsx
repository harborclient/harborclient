import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type CSSProperties, type JSX, type MouseEvent, type ReactNode } from 'react';

interface Props {
  /**
   * Stable dnd-kit sortable id for this row.
   */
  id: string;

  /**
   * Row container class names.
   */
  className: string;

  /**
   * Accessible name for the drag handle (e.g. "Reorder collection \"API\"").
   */
  dragHandleLabel: string;

  /**
   * Row contents, typically label and action controls.
   */
  children: ReactNode;

  /**
   * When true, renders a static row without drag-and-drop behavior.
   */
  disabled?: boolean;

  /**
   * Called when the user right-clicks the row container.
   */
  onRowContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;
}

/**
 * Wraps a sidebar row with dnd-kit sortable drag behavior. The row itself is
 * the drag activator; nested controls should call
 * {@link stopSortableDragPointerDown} so expand and menu actions do not start a drag.
 */
export function SortableRow({
  id,
  className,
  dragHandleLabel,
  children,
  disabled = false,
  onRowContextMenu
}: Props): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id, disabled });

  if (disabled) {
    return (
      <div className={`group ${className}`} onContextMenu={onRowContextMenu}>
        {children}
      </div>
    );
  }

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : undefined
  };

  const { role, tabIndex, ...sortableAttributes } = attributes;
  void role;
  void tabIndex;

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        setActivatorNodeRef(node);
      }}
      style={style}
      className={`${className} cursor-grab active:cursor-grabbing`}
      aria-label={dragHandleLabel}
      tabIndex={-1}
      onContextMenu={onRowContextMenu}
      {...sortableAttributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
