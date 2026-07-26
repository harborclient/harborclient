import { faCheck } from '@fortawesome/free-solid-svg-icons';
import {
  FaIcon,
  clampMenuPosition,
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
  type JSX,
  type KeyboardEvent,
  type ReactPortal
} from 'react';
import { faChevronDown } from '#/renderer/src/fontawesome';

/** Estimated width of the color options listbox. */
const LISTBOX_WIDTH_PX = 220;

/** Estimated height before the listbox is measured. */
const LISTBOX_HEIGHT_PX = 200;

interface Props {
  /**
   * Currently selected color, or null for “All colors”.
   */
  value: string | null;

  /**
   * Distinct CSS colors available in the collections tree.
   */
  colors: readonly string[];

  /**
   * Updates the draft color filter when the user picks an option.
   */
  onChange: (color: string | null) => void;

  /**
   * Id of the trigger button for label association.
   */
  id: string;
}

/**
 * Custom select for filtering by sidebar item color. The trigger shows a swatch
 * (or “All colors”); the listbox lists every distinct color plus an all option.
 *
 * @param value - Selected color, or null for all.
 * @param colors - Distinct colors from the collections tree.
 * @param onChange - Called when the user picks an option.
 * @param id - Trigger button id for the associated form label.
 */
export function FilterColorSelect({ value, colors, onChange, id }: Props): JSX.Element {
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  /**
   * Options for the listbox: “All colors” plus each distinct tree color.
   */
  const options = useMemo(
    (): Array<{ color: string | null; label: string }> => [
      { color: null, label: 'All colors' },
      ...colors.map((color) => ({ color, label: color }))
    ],
    [colors]
  );

  /**
   * Repositions the listbox under the trigger button.
   */
  const updatePosition = useCallback((): void => {
    const trigger = triggerRef.current;
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
  }, []);

  /**
   * Anchors the listbox when it opens and when its measured size changes.
   */
  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    updatePosition();
  }, [open, updatePosition, colors.length]);

  /**
   * Keeps the listbox aligned when the sidebar or viewport moves.
   */
  useEffect(() => {
    if (!open) {
      return;
    }
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  /**
   * Focuses the active option when the listbox opens or the focused index changes.
   */
  useEffect(() => {
    if (!open) {
      return;
    }
    requestAnimationFrame(() => {
      optionRefs.current[focusedIndex]?.focus();
    });
  }, [open, focusedIndex]);

  /**
   * Opens the listbox with focus on the currently selected option.
   */
  const openListbox = useCallback((): void => {
    const selectedIndex = Math.max(
      0,
      options.findIndex((option) => option.color === value)
    );
    setFocusedIndex(selectedIndex);
    setOpen(true);
  }, [options, value]);

  /**
   * Closes the listbox and returns focus to the trigger.
   */
  const closeListbox = useCallback((): void => {
    setOpen(false);
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, []);

  /**
   * Toggles the listbox open or closed from the trigger button.
   */
  const toggleListbox = useCallback((): void => {
    if (open) {
      closeListbox();
      return;
    }
    openListbox();
  }, [closeListbox, open, openListbox]);

  /**
   * Closes on outside pointer interaction or Escape.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    /**
     * Closes when the user activates outside the trigger and listbox.
     */
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (triggerRef.current?.contains(target) || listboxRef.current?.contains(target)) {
        return;
      }
      closeListbox();
    };

    /**
     * Closes the listbox when the user presses Escape.
     */
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeListbox();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [closeListbox, open]);

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
   * Applies a color selection, closes the listbox, and restores trigger focus.
   *
   * @param color - Selected color, or null for all colors.
   */
  const selectOption = useCallback(
    (color: string | null): void => {
      onChange(color);
      closeListbox();
    },
    [closeListbox, onChange]
  );

  /**
   * Handles arrow-key navigation and Tab-to-close inside the open listbox.
   *
   * @param event - Keyboard event from the listbox panel.
   */
  const handleListboxKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Tab') {
      closeListbox();
      return;
    }

    const arrowIndex = resolveTabListKeyAction(event.key, focusedIndex, options.length);
    if (arrowIndex !== null) {
      event.preventDefault();
      focusOption(arrowIndex);
    }
  };

  const listbox: ReactPortal | null =
    open && position != null
      ? portalToBody(
          <div
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-label="Color"
            className="hc-collections-filter-color-listbox app-no-drag fixed z-50 max-h-[240px] overflow-y-auto rounded-md border border-separator bg-surface py-1 shadow-md"
            style={{ top: position.y, left: position.x, width: LISTBOX_WIDTH_PX }}
            onKeyDown={handleListboxKeyDown}
          >
            {options.map((option, index) => {
              const selected = option.color === value;
              return (
                <button
                  key={option.color ?? 'all'}
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
                    selectOption(option.color);
                  }}
                >
                  <span className="inline-flex w-4 shrink-0 justify-center" aria-hidden>
                    {selected ? <FaIcon icon={faCheck} className="h-3 w-3" /> : null}
                  </span>
                  {option.color != null ? (
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-separator"
                      style={{ backgroundColor: option.color }}
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
        )
      : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        className="hc-select flex w-full cursor-pointer items-center gap-2 rounded-lg border border-separator bg-field px-2.5 py-1.5 text-left text-[14px] text-text app-no-drag focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={toggleListbox}
      >
        {value != null ? (
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-full border border-separator"
            style={{ backgroundColor: value }}
            aria-hidden
          />
        ) : null}
        <span className="min-w-0 flex-1 truncate">{value ?? 'All colors'}</span>
        <FaIcon icon={faChevronDown} className="h-3 w-3 shrink-0 text-muted" aria-hidden />
      </button>
      {listbox}
    </div>
  );
}
