import type { JSX, ReactNode } from 'react';
import { cn } from '../utils.js';

/** Pixel width of the chevron notch shared between interlocking segments. */
const CHEVRON_PX = 9;

/**
 * Shape position within the interlocking breadcrumb bar.
 */
export type SegmentShape = 'first' | 'middle' | 'last' | 'only';

/**
 * Background tone for a segment: `path` for leading collection/folder crumbs,
 * `current` for the trailing request-name crumb.
 */
export type SegmentTone = 'path' | 'current';

/**
 * Returns a CSS clip-path polygon for the given segment shape.
 *
 * @param shape - Which segment position to clip for.
 * @returns Clip-path polygon string for inline style use.
 */
function clipPathForShape(shape: SegmentShape): string {
  switch (shape) {
    case 'first':
      return `polygon(0 0, calc(100% - ${CHEVRON_PX}px) 0, 100% 50%, calc(100% - ${CHEVRON_PX}px) 100%, 0 100%)`;
    case 'middle':
      return `polygon(0 0, calc(100% - ${CHEVRON_PX}px) 0, 100% 50%, calc(100% - ${CHEVRON_PX}px) 100%, 0 100%, ${CHEVRON_PX}px 50%)`;
    case 'last':
      return `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${CHEVRON_PX}px 50%)`;
    case 'only':
    default:
      return 'none';
  }
}

/**
 * Shared shell classes and clip-path styling for one breadcrumb segment.
 */
interface Props {
  /**
   * Segment position within the bar.
   */
  shape: SegmentShape;

  /**
   * Background tone; leading crumbs use `path`, the editable crumb `current`.
   */
  tone?: SegmentTone;

  /**
   * When true, the segment grows to fill remaining horizontal space.
   */
  grow?: boolean;

  /**
   * Additional classes merged onto the segment shell.
   */
  className?: string;

  /**
   * Segment contents.
   */
  children: ReactNode;
}

/**
 * Renders the arrow-shaped background shell shared by crumb and editable segments.
 */
export function SegmentShell({
  shape,
  tone = 'path',
  grow = false,
  className,
  children
}: Props): JSX.Element {
  const hasChevron = shape !== 'only';
  const clipPath = clipPathForShape(shape);
  const needsLeadingInset = shape !== 'first' && shape !== 'only';

  return (
    <div
      className={cn(
        'hc-breadcrumb-segment relative flex min-h-[30px] min-w-0 items-center py-2',
        tone === 'current' ? 'bg-breadcrumb-current' : 'bg-breadcrumb-segment',
        grow ? 'min-w-[6rem] flex-1' : 'max-w-[45%] shrink-0',
        hasChevron && shape !== 'last' && '-mr-[6px]',
        !needsLeadingInset && 'pl-5',
        'pr-5',
        className
      )}
      style={{
        ...(clipPath !== 'none' ? { clipPath } : {}),
        ...(needsLeadingInset ? { paddingLeft: `${CHEVRON_PX + 16}px` } : {})
      }}
    >
      <div className="w-full min-w-0 truncate">{children}</div>
    </div>
  );
}
