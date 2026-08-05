import {
  type KeyboardEvent,
  type ReactPortal,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import {
  type MenuPosition,
  clampMenuPosition,
  getTriggerAnchoredMenuPosition
} from '../menuPosition.js';
import { portalToBody } from '../portalToBody.js';
import { resolveTabListKeyAction } from '../utils.js';
import { SortMenuOption } from './SortMenuOption.js';
import type { SortOption } from './sortOptions.js';

/** Estimated width of the sort option listbox. */
const LISTBOX_WIDTH_PX = 240;

/** Estimated height before the listbox is measured. */
const LISTBOX_HEIGHT_PX = 220;

interface Props {
  /**
   * Sort toolbar button used to anchor the portaled listbox.
   */
  anchorRef: RefObject<HTMLElement | null>;

  /**
   * Selectable sort options to render.
   */
  options: readonly SortOption[];

  /**
   * Currently selected option id.
   */
  value: string;

  /**
   * Accessible name for the listbox.
   */
  ariaLabel?: string;

  /**
   * Applies a sort selection and should close the menu.
   */
  onSelect: (id: string) => void;

  /**
   * Closes the menu without changing the sort.
   */
  onClose: () => void;
}

/**
 * Portaled single-select listbox of sort options. Selecting an option applies
 * immediately and closes the menu (filter-menu style).
 *
 * @param anchorRef - Sort toolbar button used for positioning.
 * @param options - Sort options to render.
 * @param value - Currently selected option id.
 * @param ariaLabel - Accessible name for the listbox.
 * @param onSelect - Called when the user picks an option.
 * @param onClose - Called when the menu should dismiss.
 */
export function SortMenu({
  anchorRef,
  options,
  value,
  ariaLabel = 'Sort',
  onSelect,
  onClose
}: Props): ReactPortal | null {
  const listboxId = useId();
  const listboxRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const [focusedIndex, setFocusedIndex] = useState(() =>
    Math.max(
      0,
      options.findIndex((option) => option.id === value)
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
   * Anchors the listbox when it mounts and when its option count changes.
   */
  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition, options.length]);

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
      aria-label={ariaLabel}
      className="hc-sort-menu-listbox fixed z-50 max-h-[280px] overflow-y-auto rounded-md border border-separator bg-surface py-1 shadow-md"
      style={{ top: position.y, left: position.x, width: LISTBOX_WIDTH_PX }}
      onKeyDown={handleListboxKeyDown}
    >
      {options.map((option, index) => (
        <SortMenuOption
          key={option.id}
          label={option.label}
          selected={option.id === value}
          focused={index === focusedIndex}
          optionRef={(element) => {
            optionRefs.current[index] = element;
          }}
          onSelect={() => onSelect(option.id)}
        />
      ))}
    </div>
  );
}
