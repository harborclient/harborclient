import { useDroppable } from '@dnd-kit/core';
import { type JSX, type ReactNode } from 'react';

interface Props {
  /**
   * Stable dnd-kit droppable id for this container.
   */
  id: string;

  /**
   * Optional container class names, e.g. drop-target highlight styles.
   */
  className?: string;

  /**
   * Drop zone contents.
   */
  children: ReactNode;

  /**
   * When true, renders a plain container without droppable registration.
   */
  disabled?: boolean;
}

/**
 * Registers a droppable container for request drag-and-drop within a collection tree.
 */
export function DropZone({ id, className, children, disabled = false }: Props): JSX.Element {
  const { setNodeRef } = useDroppable({ id, disabled });

  if (disabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
}
