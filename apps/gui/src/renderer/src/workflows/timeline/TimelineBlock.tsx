import type { JSX, ReactNode } from 'react';

interface Props {
  /**
   * Accessible name for the seek button (primary action description).
   */
  label: string;

  /**
   * True when this block is the playback cursor.
   */
  selected: boolean;

  /**
   * Pixel width of the segment on the timeline track.
   */
  widthPx: number;

  /**
   * Seeks the playback cursor to this block without dispatching.
   */
  onSeek: () => void;

  /**
   * When true, the block cannot be activated (e.g. while playing).
   */
  disabled?: boolean;

  /**
   * Thumbnail content from the workflow registry entry.
   */
  children: ReactNode;
}

/**
 * Shared chrome for a single workflow timeline segment.
 *
 * Renders as a button so keyboard users can seek; width reflects recorded
 * duration (subject to a layout min-width).
 *
 * @param props - Label, selection, width, and thumbnail children.
 * @returns Timeline block button wrapping thumbnail content.
 */
export function TimelineBlock({
  label,
  selected,
  widthPx,
  onSeek,
  disabled = false,
  children
}: Props): JSX.Element {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      aria-label={label}
      disabled={disabled}
      onClick={onSeek}
      className={[
        'relative flex h-full min-h-[56px] shrink-0 flex-col justify-center overflow-hidden rounded-md border px-2 py-1.5 text-left transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
        selected
          ? 'border-accent bg-accent/10 text-fg'
          : 'border-separator bg-surface-raised text-fg hover:border-accent/60',
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
      ].join(' ')}
      style={{ width: widthPx }}
    >
      {children}
    </button>
  );
}
