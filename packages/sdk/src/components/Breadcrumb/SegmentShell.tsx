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
 * `selection` for the first path crumb highlight, `current` for the trailing
 * request-name crumb.
 */
export type SegmentTone = 'path' | 'selection' | 'current';

/**
 * Vertical and horizontal density for a segment shell.
 *
 * - `default` — full breadcrumb bar sizing (`min-h-[26px]`, generous padding).
 * - `compact` — toolbar-height sizing for controls like Copy to chat.
 */
export type SegmentDensity = 'default' | 'compact';

/**
 * Returns a CSS clip-path polygon for the given segment shape.
 *
 * @param shape - Which segment position to clip for.
 * @returns Clip-path polygon string for inline style use, or `none` when unused.
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
   * Background tone; leading crumbs use `path` (or `selection` for the first),
   * the editable crumb `current`.
   */
  tone?: SegmentTone;

  /**
   * When true, the segment grows to fill remaining horizontal space.
   */
  grow?: boolean;

  /**
   * Vertical and horizontal density. Defaults to full breadcrumb bar sizing.
   */
  density?: SegmentDensity;

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
 *
 * First and only shapes use an overflow-hidden rounded wrapper so the left (or
 * full) edge matches the URL bar's `rounded-md` corners; middle and last keep a
 * single clip-path layer for chevron interlocking.
 */
export function SegmentShell({
  shape,
  tone = 'path',
  grow = false,
  density = 'default',
  className,
  children
}: Props): JSX.Element {
  const hasChevron = shape !== 'only';
  const clipPath = clipPathForShape(shape);
  const needsLeadingInset = shape !== 'first' && shape !== 'only';
  const isCompact = density === 'compact';
  const toneClass =
    tone === 'current'
      ? 'bg-breadcrumb-current'
      : tone === 'selection'
        ? 'bg-selection'
        : 'bg-breadcrumb-segment';
  const usesRoundedCap = shape === 'first' || shape === 'only';
  const leadingInsetPx = CHEVRON_PX + (isCompact ? 10 : 16);

  const layoutClass = cn(
    'hc-breadcrumb-segment relative flex min-w-0 items-center',
    isCompact ? 'min-h-0 py-1' : 'min-h-[26px] py-2',
    grow ? 'min-w-[6rem] flex-1' : isCompact ? 'shrink-0' : 'max-w-[45%] shrink-0',
    hasChevron && shape !== 'last' && '-mr-[6px]',
    !needsLeadingInset && (isCompact ? 'pl-2.5' : 'pl-5'),
    isCompact ? 'pr-3' : 'pr-5',
    className
  );

  const content = (
    <div
      className={cn(
        'relative min-w-0',
        isCompact ? 'flex items-center gap-1.5' : 'w-full truncate'
      )}
    >
      {children}
    </div>
  );

  if (usesRoundedCap) {
    return (
      <div
        className={cn(layoutClass, 'overflow-hidden', 'rounded-md!')}
        style={needsLeadingInset ? { paddingLeft: `${leadingInsetPx}px` } : undefined}
      >
        <div
          aria-hidden
          className={cn('pointer-events-none absolute inset-0', toneClass)}
          style={clipPath !== 'none' ? { clipPath } : undefined}
        />
        {content}
      </div>
    );
  }

  return (
    <div
      className={cn(layoutClass, toneClass)}
      style={{
        ...(clipPath !== 'none' ? { clipPath } : {}),
        ...(needsLeadingInset ? { paddingLeft: `${leadingInsetPx}px` } : {})
      }}
    >
      {content}
    </div>
  );
}
