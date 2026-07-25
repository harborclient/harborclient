import type {
  ComponentPropsWithoutRef,
  JSX,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent
} from 'react';
import { cn } from '../utils.js';

interface Props extends Omit<
  ComponentPropsWithoutRef<'div'>,
  'children' | 'aria-label' | 'aria-valuenow' | 'aria-valuemin' | 'aria-valuemax' | 'aria-valuetext'
> {
  /**
   * Handle orientation: horizontal resizes height, vertical resizes width.
   */
  orientation: 'horizontal' | 'vertical';

  /**
   * Current panel size in pixels for valued separator semantics.
   */
  value: number;

  /**
   * Minimum allowed panel size in pixels.
   */
  min: number;

  /**
   * Maximum allowed panel size in pixels.
   */
  max: number;

  /**
   * Called when the user starts dragging the handle.
   */
  onResizeStart: (event: ReactMouseEvent) => void;

  /**
   * Called when the user presses arrow keys on the focused handle.
   */
  onKeyboardResize: (event: ReactKeyboardEvent) => void;

  /**
   * Accessible label for the separator.
   */
  ariaLabel: string;

  /**
   * Formats the spoken value for assistive tech. Defaults to
   * e.g. "Width 487 pixels" based on orientation.
   */
  formatValueText?: (value: number, orientation: 'horizontal' | 'vertical') => string;
}

/**
 * Draggable separator handle for resizable panels.
 */
export function ResizeHandle({
  orientation,
  value,
  min,
  max,
  onResizeStart,
  onKeyboardResize,
  ariaLabel,
  formatValueText,
  className,
  ...props
}: Props): JSX.Element {
  const isHorizontal = orientation === 'horizontal';
  const dimension = isHorizontal ? 'Height' : 'Width';
  const valueText = formatValueText
    ? formatValueText(value, orientation)
    : `${dimension} ${Math.round(value)} pixels`;

  return (
    <div
      {...props}
      role="separator"
      tabIndex={0}
      className={cn(
        'hc-resize-handle font-inherit app-no-drag m-0 flex shrink-0 items-center justify-center bg-control p-0 text-inherit hover:bg-selection/60',
        isHorizontal
          ? 'h-1.5 w-full cursor-row-resize border-b border-separator'
          : 'h-full w-1.5 cursor-col-resize border-r border-separator',
        className
      )}
      onMouseDown={onResizeStart}
      onKeyDown={onKeyboardResize}
      aria-orientation={orientation}
      aria-label={ariaLabel}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={Math.round(max)}
      aria-valuetext={valueText}
    >
      <div
        className={
          isHorizontal
            ? 'hc-resize-handle-grip h-0.5 w-8 rounded-full bg-muted/50'
            : 'hc-resize-handle-grip h-8 w-0.5 rounded-full bg-muted/50'
        }
        aria-hidden
      />
    </div>
  );
}
