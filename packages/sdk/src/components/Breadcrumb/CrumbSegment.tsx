import type { JSX, MouseEvent } from 'react';
import { cn } from '../utils.js';
import { type SegmentShape, SegmentShell } from './SegmentShell.js';
import type { BreadcrumbSegment } from './types.js';

interface Props {
  /**
   * Crumb data and optional navigation handler.
   */
  segment: BreadcrumbSegment;

  /**
   * Segment position within the bar.
   */
  shape: SegmentShape;
}

/**
 * Renders one leading, non-editable breadcrumb segment.
 */
export function CrumbSegment({ segment, shape }: Props): JSX.Element {
  const contentClass = cn(
    'block w-full truncate border-none bg-transparent p-0 text-left',
    segment.onClick && 'cursor-pointer hover:text-text focus-visible:text-text'
  );

  /**
   * Stops click propagation so breadcrumb navigation does not trigger edit mode.
   *
   * @param event - Mouse event from a breadcrumb segment control.
   */
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    segment.onClick?.();
  };

  return (
    <SegmentShell shape={shape}>
      {segment.onClick ? (
        <button
          type="button"
          className={cn(
            contentClass,
            'app-no-drag focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent'
          )}
          onClick={handleClick}
        >
          {segment.label}
        </button>
      ) : (
        <span className={contentClass}>{segment.label}</span>
      )}
    </SegmentShell>
  );
}
