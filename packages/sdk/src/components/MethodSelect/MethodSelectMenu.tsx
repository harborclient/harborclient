import {
  type KeyboardEvent,
  type ReactPortal,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import type { HttpMethod } from '../../types.js';
import {
  type MenuPosition,
  clampMenuPosition,
  getTriggerAnchoredMenuPosition
} from '../menuPosition.js';
import { portalToBody } from '../portalToBody.js';
import { resolveTabListKeyAction } from '../utils.js';
import { MethodSelectOption } from './MethodSelectOption.js';
import { MethodSelectSeparator } from './MethodSelectSeparator.js';

/** HTTP methods listed above the SSE separator. */
const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

/** Selectable listbox entries (methods plus SSE). */
const SELECTABLE_OPTIONS: Array<{ label: string; colorKey: string; id: string }> = [
  ...METHODS.map((method) => ({ label: method, colorKey: method, id: method })),
  { label: 'SSE', colorKey: 'sse', id: 'SSE' }
];

/** Index of the SSE option in {@link SELECTABLE_OPTIONS}. */
const SSE_OPTION_INDEX = SELECTABLE_OPTIONS.length - 1;

/** Estimated width of the method options listbox. */
const LISTBOX_WIDTH_PX = 120;

/** Estimated height before the listbox is measured. */
const LISTBOX_HEIGHT_PX = 280;

interface Props {
  /**
   * Method select trigger used to anchor the portaled listbox.
   */
  anchorRef: RefObject<HTMLElement | null>;

  /**
   * Id of the listbox element for `aria-controls` wiring.
   */
  listboxId: string;

  /**
   * Currently selected option id (`GET`…`OPTIONS` or `SSE`).
   */
  value: string;

  /**
   * Applies a selection and closes the menu.
   *
   * @param id - Chosen option id.
   */
  onSelect: (id: string) => void;

  /**
   * Closes the menu without changing the selection.
   */
  onClose: () => void;
}

/**
 * Portaled listbox of HTTP methods and SSE, with a theme separator before SSE.
 *
 * @param props - Anchor, selection, and close handlers.
 * @returns Portaled listbox, or `null` until positioned.
 */
export function MethodSelectMenu({
  anchorRef,
  listboxId,
  value,
  onSelect,
  onClose
}: Props): ReactPortal | null {
  const listboxRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(() =>
    Math.max(
      0,
      SELECTABLE_OPTIONS.findIndex((option) => option.id === value)
    )
  );

  /**
   * Repositions the listbox under the trigger, left-aligned with the method control.
   */
  const updatePosition = useCallback((): void => {
    const trigger = anchorRef.current;
    if (!trigger) {
      setPosition(null);
      return;
    }
    const triggerRect = trigger.getBoundingClientRect();
    const menuSize = {
      width: Math.max(LISTBOX_WIDTH_PX, triggerRect.width),
      height: listboxRef.current?.offsetHeight ?? LISTBOX_HEIGHT_PX
    };
    const requested = getTriggerAnchoredMenuPosition(triggerRect, menuSize, 'down');
    // Prefer left-align with the URL-bar method control (helper right-aligns by default).
    const leftAligned = { x: triggerRect.left, y: requested.y };
    setPosition(clampMenuPosition(leftAligned, menuSize));
  }, [anchorRef]);

  /**
   * Anchors the listbox when it mounts.
   */
  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  /**
   * Keeps the listbox aligned when the viewport or editor scrolls/resizes.
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
     *
     * @param event - Document pointer event.
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
     *
     * @param event - Document keydown event.
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

    const arrowIndex = resolveTabListKeyAction(event.key, focusedIndex, SELECTABLE_OPTIONS.length);
    if (arrowIndex !== null) {
      event.preventDefault();
      focusOption(arrowIndex);
    }
  };

  if (position == null) {
    return null;
  }

  const menuWidth = Math.max(
    LISTBOX_WIDTH_PX,
    anchorRef.current?.getBoundingClientRect().width ?? LISTBOX_WIDTH_PX
  );

  return portalToBody(
    <div
      ref={listboxRef}
      id={listboxId}
      role="listbox"
      aria-label="Request method or protocol"
      className="hc-method-select-listbox fixed z-50 max-h-[320px] overflow-y-auto rounded-md border border-separator bg-surface py-1 shadow-md"
      style={{ top: position.y, left: position.x, width: menuWidth }}
      onKeyDown={handleListboxKeyDown}
    >
      {METHODS.map((method, index) => (
        <MethodSelectOption
          key={method}
          label={method}
          colorKey={method}
          selected={method === value}
          focused={index === focusedIndex}
          optionRef={(element) => {
            optionRefs.current[index] = element;
          }}
          onSelect={() => onSelect(method)}
        />
      ))}
      <MethodSelectSeparator />
      <MethodSelectOption
        label="SSE"
        colorKey="sse"
        selected={value === 'SSE'}
        focused={focusedIndex === SSE_OPTION_INDEX}
        optionRef={(element) => {
          optionRefs.current[SSE_OPTION_INDEX] = element;
        }}
        onSelect={() => onSelect('SSE')}
      />
    </div>
  );
}
