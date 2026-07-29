import type { JSX, KeyboardEvent, MouseEvent, ReactNode } from 'react';

interface Props {
  /**
   * Optional DOM id for aria-activedescendant targeting.
   */
  id?: string;

  /**
   * Accessible name for the seek control (primary action description).
   */
  label: string;

  /**
   * True when this block is the playback cursor.
   */
  selected: boolean;

  /**
   * Pixel width of the segment on the timeline track.
   * Required when {@link fillWidth} is false; ignored when filling the container.
   */
  widthPx?: number;

  /**
   * When true, the block stretches to 100% of its parent width instead of using {@link widthPx}.
   */
  fillWidth?: boolean;

  /**
   * When true, height follows content instead of filling the parent (`h-full`).
   * Used for vertical result lists; timeline tracks keep the default stretch behavior.
   */
  fitContent?: boolean;

  /**
   * Seeks the playback cursor to this block without dispatching.
   */
  onSeek: () => void;

  /**
   * Opens the payload editor for this action (typically on double-click).
   */
  onEditPayload?: () => void;

  /**
   * Opens the action context menu at the pointer position.
   *
   * @param event - Native contextmenu event from the block chrome.
   */
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void;

  /**
   * When true, the block cannot be activated (e.g. while playing).
   */
  disabled?: boolean;

  /**
   * Thumbnail content from the workflow registry entry.
   */
  children: ReactNode;

  /**
   * Optional plugin HostedSurface region rendered below the thumbnail.
   * Kept outside the seek control so interactive webviews are valid HTML.
   */
  pluginSurface?: ReactNode;
}

/**
 * Shared chrome for a single workflow timeline segment.
 *
 * Uses a `div` with `role="option"` (not a `<button>`) so plugin HostedSurface
 * webviews can nest inside without invalid interactive nesting. Seek / edit /
 * context menu stay on the thumbnail chrome; plugin surfaces stop propagation.
 *
 * @param props - Label, selection, width, fitContent, handlers, thumbnail, and optional plugin surface.
 * @returns Timeline block option wrapping thumbnail and plugin surface children.
 */
export function TimelineBlock({
  id,
  label,
  selected,
  widthPx,
  fillWidth = false,
  fitContent = false,
  onSeek,
  onEditPayload,
  onContextMenu,
  disabled = false,
  children,
  pluginSurface
}: Props): JSX.Element {
  /**
   * Seeks when the user activates the block via keyboard.
   *
   * @param event - Keyboard event from the option element.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSeek();
    }
  };

  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      aria-label={label}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      onContextMenu={(event) => {
        if (onContextMenu == null) {
          return;
        }
        event.preventDefault();
        onContextMenu(event);
      }}
      className={[
        'relative flex min-h-[56px] flex-col overflow-hidden rounded-md border text-left transition-colors',
        fitContent ? 'h-auto' : 'h-full',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
        fillWidth ? 'w-full min-w-0' : 'shrink-0',
        selected
          ? 'border-accent bg-accent/10 text-text'
          : 'border-separator bg-surface text-text hover:border-accent/60',
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
      ].join(' ')}
      style={fillWidth ? { width: '100%' } : { width: widthPx }}
    >
      <div
        className={[
          'flex min-h-0 min-w-0 flex-1 flex-col justify-center',
          fitContent ? 'px-3 py-3' : 'px-2 py-1.5'
        ].join(' ')}
        onClick={() => {
          if (!disabled) {
            onSeek();
          }
        }}
        onDoubleClick={() => {
          if (disabled || onEditPayload == null) {
            return;
          }
          onEditPayload();
        }}
      >
        {children}
      </div>
      {pluginSurface != null ? (
        <div
          className="relative min-h-[28px] shrink-0 border-t border-separator"
          onClick={(event) => {
            event.stopPropagation();
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
        >
          {pluginSurface}
        </div>
      ) : null}
    </div>
  );
}
