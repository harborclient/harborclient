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
  useRef,
  useState,
  type KeyboardEvent,
  type ReactPortal,
  type RefObject
} from 'react';

/** Width used to right-align the view menu under the toolbar trigger. */
const MENU_WIDTH_PX = 220;

/** Estimated height before the panel is measured. */
const MENU_HEIGHT_PX = 88;

interface Props {
  /**
   * Toolbar View button used to anchor the portaled menu.
   */
  anchorRef: RefObject<HTMLElement | null>;

  /**
   * Whether storage-location badges are currently shown on sidebar rows.
   */
  showStorageLocationBadges: boolean;

  /**
   * Whether color dots are currently shown on sidebar rows.
   */
  showColorDots: boolean;

  /**
   * Toggles storage-location badge visibility.
   */
  onToggleStorageLocationBadges: () => void;

  /**
   * Toggles color-dot visibility.
   */
  onToggleColorDots: () => void;

  /**
   * Closes the view options menu.
   */
  onClose: () => void;
}

/**
 * Computes fixed menu coordinates right-aligned to the View toolbar button.
 *
 * @param anchor - Toolbar View button element.
 * @returns Viewport coordinates, or null when the anchor is unavailable.
 */
function getMenuPosition(anchor: HTMLElement | null): MenuPosition | null {
  if (!anchor) {
    return null;
  }

  const triggerRect = anchor.getBoundingClientRect();
  const menuSize = { width: MENU_WIDTH_PX, height: MENU_HEIGHT_PX };
  const requested = getTriggerAnchoredMenuPosition(triggerRect, menuSize, 'down');
  return clampMenuPosition(requested, menuSize);
}

/**
 * Portaled checkbox menu for Collections sidebar display preferences
 * (storage-location badges and color dots).
 *
 * @param anchorRef - Toolbar View button used for positioning.
 * @param showStorageLocationBadges - Whether storage badges are visible.
 * @param showColorDots - Whether color dots are visible.
 * @param onToggleStorageLocationBadges - Toggles storage badges.
 * @param onToggleColorDots - Toggles color dots.
 * @param onClose - Closes the menu.
 */
export function SidebarViewMenu({
  anchorRef,
  showStorageLocationBadges,
  showColorDots,
  onToggleStorageLocationBadges,
  onToggleColorDots,
  onClose
}: Props): ReactPortal | null {
  const reactId = useId();
  const menuElementId = `sidebar-view-options-menu-${reactId}`;
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const items = [
    {
      id: 'storage-badges',
      label: 'Storage location badges',
      checked: showStorageLocationBadges,
      onSelect: onToggleStorageLocationBadges
    },
    {
      id: 'color-dots',
      label: 'Color dots',
      checked: showColorDots,
      onSelect: onToggleColorDots
    }
  ] as const;

  /**
   * Repositions the menu under the View toolbar button.
   */
  const updatePosition = useCallback((): void => {
    setPosition(getMenuPosition(anchorRef.current));
  }, [anchorRef]);

  /**
   * Anchors the menu to the View button on open.
   */
  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  /**
   * Keeps fixed coordinates aligned when the sidebar or viewport moves.
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
   * Moves focus onto the first checkbox when the menu mounts.
   */
  useEffect(() => {
    requestAnimationFrame(() => {
      itemRefs.current[0]?.focus();
    });
  }, []);

  /**
   * Closes the menu and returns focus to the View toolbar button.
   */
  const closeMenu = useCallback((): void => {
    onClose();
    requestAnimationFrame(() => {
      anchorRef.current?.focus();
    });
  }, [anchorRef, onClose]);

  /**
   * Closes the menu on outside pointer interaction or Escape.
   */
  useEffect(() => {
    /**
     * Closes when the user activates outside the anchor and portaled menu.
     */
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const anchor = anchorRef.current;
      const menu = panelRef.current;
      if (anchor?.contains(target) || menu?.contains(target)) {
        return;
      }

      closeMenu();
    };

    /**
     * Closes the menu when the user presses Escape.
     */
    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, closeMenu]);

  /**
   * Focuses a menu item by index for roving tabindex navigation.
   *
   * @param index - Item index to focus.
   */
  const focusItem = useCallback((index: number): void => {
    setFocusedIndex(index);
    requestAnimationFrame(() => {
      itemRefs.current[index]?.focus();
    });
  }, []);

  /**
   * Handles arrow-key navigation and Tab-to-close inside the open menu.
   *
   * @param event - Keyboard event from the menu panel.
   */
  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Tab') {
      closeMenu();
      return;
    }

    const arrowIndex = resolveTabListKeyAction(event.key, focusedIndex, items.length);
    if (arrowIndex !== null) {
      event.preventDefault();
      focusItem(arrowIndex);
    }
  };

  if (position == null) {
    return null;
  }

  return portalToBody(
    <div
      ref={panelRef}
      id={menuElementId}
      role="menu"
      aria-label="View options"
      className="hc-sidebar-view-menu app-no-drag fixed z-50 rounded-md border border-separator bg-surface py-1 shadow-md"
      style={{ top: position.y, left: position.x, width: MENU_WIDTH_PX }}
      onKeyDown={handleMenuKeyDown}
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={(element) => {
            itemRefs.current[index] = element;
          }}
          type="button"
          role="menuitemcheckbox"
          aria-checked={item.checked}
          tabIndex={index === focusedIndex ? 0 : -1}
          className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent px-3.5 py-1.5 text-left text-[14px] text-text hover:bg-selection app-no-drag"
          onClick={(event) => {
            event.stopPropagation();
            item.onSelect();
          }}
        >
          <span className="inline-flex w-4 shrink-0 justify-center" aria-hidden>
            {item.checked ? <FaIcon icon={faCheck} className="h-3 w-3" /> : null}
          </span>
          <span className="min-w-0">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
