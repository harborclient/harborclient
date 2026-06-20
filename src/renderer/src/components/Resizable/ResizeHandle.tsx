import type { JSX, MouseEvent as ReactMouseEvent } from 'react';

interface Props {
  /**
   * Handle orientation: horizontal resizes height, vertical resizes width.
   */
  orientation: 'horizontal' | 'vertical';

  /**
   * Called when the user starts dragging the handle.
   */
  onResizeStart: (event: ReactMouseEvent) => void;

  /**
   * Accessible label for the separator.
   */
  ariaLabel: string;

  /**
   * Optional additional classes for the handle container.
   */
  className?: string;
}

/**
 * Draggable separator handle for resizable panels.
 */
export function ResizeHandle({
  orientation,
  onResizeStart,
  ariaLabel,
  className
}: Props): JSX.Element {
  const isHorizontal = orientation === 'horizontal';
  const containerClassName = [
    'flex shrink-0 items-center justify-center bg-control hover:bg-selection/60',
    isHorizontal
      ? 'h-1.5 w-full cursor-row-resize border-b border-separator'
      : 'h-full w-1.5 cursor-col-resize border-r border-separator',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={containerClassName}
      onMouseDown={onResizeStart}
      role="separator"
      aria-orientation={orientation}
      aria-label={ariaLabel}
    >
      <div
        className={
          isHorizontal ? 'h-0.5 w-8 rounded-full bg-muted/50' : 'h-8 w-0.5 rounded-full bg-muted/50'
        }
      />
    </div>
  );
}
