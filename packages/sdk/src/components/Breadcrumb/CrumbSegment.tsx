import type { JSX, MouseEvent, ReactNode } from 'react';
import { FaIcon } from '../FaIcon/index.js';
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
    'flex w-full min-w-0 items-center gap-2 border-none bg-transparent p-0 text-left',
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

  const showLabel = !segment.iconOnly && segment.label.length > 0;
  const accessibleName = segment.ariaLabel ?? (showLabel ? undefined : segment.label);

  const content: ReactNode = (
    <>
      {segment.icon && <FaIcon icon={segment.icon} className="h-3.5 w-3.5 shrink-0" />}
      {showLabel ? <span className="min-w-0 truncate">{segment.label}</span> : null}
    </>
  );

  return (
    <SegmentShell shape={shape} tone={shape === 'first' ? 'selection' : 'path'}>
      {segment.onClick ? (
        <button
          type="button"
          className={cn(
            contentClass,
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent'
          )}
          aria-label={accessibleName}
          onClick={handleClick}
        >
          {content}
        </button>
      ) : (
        <span className={contentClass} aria-label={accessibleName}>
          {content}
        </span>
      )}
    </SegmentShell>
  );
}
