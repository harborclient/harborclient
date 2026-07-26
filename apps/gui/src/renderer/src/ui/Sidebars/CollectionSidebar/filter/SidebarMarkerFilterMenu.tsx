import { faCheck } from '@fortawesome/free-solid-svg-icons';
import {
  FaIcon,
  clampMenuPosition,
  colorsMatch,
  getTriggerAnchoredMenuPosition,
  portalToBody,
  resolveTabListKeyAction,
  type MenuPosition
} from '@harborclient/sdk/components';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactPortal,
  type RefObject
} from 'react';

/** Estimated width of the marker filter listbox. */
const LISTBOX_WIDTH_PX = 220;

/** Estimated height before the listbox is measured. */
const LISTBOX_HEIGHT_PX = 200;

interface Props {
  /**
   * Filter toolbar button used to anchor the portaled listbox.
   */
  anchorRef: RefObject<HTMLElement | null>;

  /**
   * Distinct CSS markers available in the section tree.
   */
  markers: readonly string[];

  /**
   * Currently selected marker filter, or null for all markers.
   */
  filter: string | null;

  /**
   * Applies a marker selection (or null for all) and should close the menu.
   */
  onSelect: (marker: string | null) => void;

  /**
   * Closes the menu without changing the filter.
   */
  onClose: () => void;
}

/**
 * Portaled listbox of markers found in a sidebar section. Selecting an option
 * applies the filter immediately (Runs/History style).
 *
 * @param anchorRef - Filter toolbar button used for positioning.
 * @param markers - Distinct markers from the section items.
 * @param filter - Applied marker filter, or null for all.
 * @param onSelect - Called when the user picks an option.
 * @param onClose - Called when the menu should dismiss.
 */
export function SidebarMarkerFilterMenu({
  anchorRef,
  markers,
  filter,
  onSelect,
  onClose
}: Props): ReactPortal | null {
  const listboxId = useId();
  const listboxRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  /**
   * Options for the listbox: “All color markers” plus each distinct section marker.
   */
  const options = useMemo(
    (): Array<{ marker: string | null; label: string }> => [
      { marker: null, label: 'All color markers' },
      ...markers.map((marker) => ({ marker, label: marker }))
    ],
    [markers]
  );

  const [focusedIndex, setFocusedIndex] = useState(() =>
    Math.max(
      0,
      [null as string | null, ...markers].findIndex((marker) =>
        marker == null ? filter == null : colorsMatch(marker, filter)
      )
    )
  );

  /**
   * Repositions the listbox under the trigger button.
   */
  const updatePosition = useCallback((): void => {
    const trigger = anchorRef.current;
    if (!trigger) {
      setPosition(null);
      return;
    }
    const triggerRect = trigger.getBoundingClientRect();
    const menuSize = {
      width: LISTBOX_WIDTH_PX,
      height: listboxRef.current?.offsetHeight ?? LISTBOX_HEIGHT_PX
    };
    const requested = getTriggerAnchoredMenuPosition(triggerRect, menuSize, 'down');
    setPosition(clampMenuPosition(requested, menuSize));
  }, [anchorRef]);

  /**
   * Anchors the listbox when it mounts and when its measured size changes.
   */
  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition, markers.length]);

  /**
   * Keeps the listbox aligned when the sidebar or viewport moves.
   */
  useEffect(() => {
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [updatePosition]);

  /**
   * Focuses the active option when the listbox mounts or the focused index changes.
   */
  useEffect(() => {
    requestAnimationFrame(() => {
      optionRefs.current[focusedIndex]?.focus();
    });
  }, [focusedIndex]);

  /**
   * Closes on outside pointer interaction or Escape.
   */
  useEffect(() => {
    /**
     * Closes when the user activates outside the trigger and listbox.
     */
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (anchorRef.current?.contains(target) || listboxRef.current?.contains(target)) {
        return;
      }
      onClose();
    };

    /**
     * Closes the listbox when the user presses Escape.
     */
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [anchorRef, onClose]);

  /**
   * Focuses a listbox option by index for roving tabindex navigation.
   *
   * @param index - Option index to focus.
   */
  const focusOption = useCallback((index: number): void => {
    setFocusedIndex(index);
    requestAnimationFrame(() => {
      optionRefs.current[index]?.focus();
    });
  }, []);

  /**
   * Applies a marker selection (toggling off when the same marker is re-selected)
   * and closes the menu.
   *
   * @param marker - Selected marker, or null for all markers.
   */
  const selectOption = useCallback(
    (marker: string | null): void => {
      if (marker != null && colorsMatch(filter, marker)) {
        onSelect(null);
      } else {
        onSelect(marker);
      }
    },
    [filter, onSelect]
  );

  /**
   * Handles arrow-key navigation and Tab-to-close inside the open listbox.
   *
   * @param event - Keyboard event from the listbox panel.
   */
  const handleListboxKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Tab') {
      onClose();
      return;
    }

    const arrowIndex = resolveTabListKeyAction(event.key, focusedIndex, options.length);
    if (arrowIndex !== null) {
      event.preventDefault();
      focusOption(arrowIndex);
    }
  };

  if (position == null) {
    return null;
  }

  return portalToBody(
    <div
      ref={listboxRef}
      id={listboxId}
      role="listbox"
      aria-label="Color marker"
      className="hc-sidebar-marker-filter-listbox app-no-drag fixed z-50 max-h-[240px] overflow-y-auto rounded-md border border-separator bg-surface py-1 shadow-md"
      style={{ top: position.y, left: position.x, width: LISTBOX_WIDTH_PX }}
      onKeyDown={handleListboxKeyDown}
    >
      {options.map((option, index) => {
        const selected =
          option.marker == null ? filter == null : colorsMatch(option.marker, filter);
        return (
          <button
            key={option.marker ?? 'all'}
            ref={(element) => {
              optionRefs.current[index] = element;
            }}
            type="button"
            role="option"
            aria-selected={selected}
            tabIndex={index === focusedIndex ? 0 : -1}
            className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3.5 py-1.5 text-left text-[14px] text-text hover:bg-selection app-no-drag"
            onClick={(event) => {
              event.stopPropagation();
              selectOption(option.marker);
            }}
          >
            <span className="inline-flex w-4 shrink-0 justify-center" aria-hidden>
              {selected ? <FaIcon icon={faCheck} className="h-3 w-3" /> : null}
            </span>
            {option.marker != null ? (
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full border border-separator"
                style={{ backgroundColor: option.marker }}
                aria-hidden
              />
            ) : (
              <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            <span className="min-w-0 truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
