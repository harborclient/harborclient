import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from '@harborclient/sdk/react';
import type { JSX, KeyboardEvent } from 'react';
import type { MenuItem } from '../RowActionsMenu/index.js';
import { type MenuPosition, clampMenuPosition } from '../menuPosition.js';
import { portalToBody } from '../portalToBody.js';
import {
  findAdjacentEnabledIndex,
  findEdgeEnabledIndex,
  isMenuItemEnabled,
  menuItemClass
} from '../rowActionsMenuHelpers.js';
import { cn, resolveTabListKeyAction } from '../utils.js';

interface Props {
  /**
   * Grouped menu entries. Each inner array is one visual group separated by a divider.
   */
  groups: MenuItem[][];

  /**
   * Cursor position used to anchor the menu panel.
   */
  position: MenuPosition;

  /**
   * Called when the menu should close without selecting an item.
   */
  onClose: () => void;
}

/**
 * Cursor-positioned context menu for tab bars, rendered in a portal at the click point.
 *
 * @param props - Menu groups, cursor anchor, and close handler.
 * @returns Portal menu panel, or null when there are no items.
 */
export function TabContextMenu({ groups, position, onClose }: Props): JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [clampedPosition, setClampedPosition] = useState(position);
  const flatItems = useMemo(() => groups.flat(), [groups]);

  /**
   * Closes the menu and notifies the parent.
   */
  const closeMenu = useCallback((): void => {
    onClose();
  }, [onClose]);

  /**
   * Focuses a menu item by index and updates roving tabindex state.
   *
   * @param index - Flat index into `flatItems`.
   */
  const focusItem = useCallback((index: number): void => {
    setFocusedIndex(index);
    requestAnimationFrame(() => {
      itemRefs.current[index]?.focus();
    });
  }, []);

  /**
   * Re-clamps the menu after mount and focuses the first enabled item once dimensions are known.
   */
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }

    const rect = menu.getBoundingClientRect();
    setClampedPosition(
      clampMenuPosition(position, {
        width: rect.width,
        height: rect.height
      })
    );
    const firstEnabled = findEdgeEnabledIndex(flatItems, false);
    if (firstEnabled != null) {
      focusItem(firstEnabled);
    }
  }, [position, groups, flatItems, focusItem]);

  /**
   * Closes the menu on outside click or Escape while it is open.
   */
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMenu]);

  /**
   * Handles keyboard navigation within the open menu.
   *
   * @param event - Keyboard event from the menu panel.
   */
  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (flatItems.length === 0) {
      return;
    }

    if (event.key === 'Tab') {
      closeMenu();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const next = findAdjacentEnabledIndex(flatItems, focusedIndex, direction);
      if (next != null) {
        event.preventDefault();
        focusItem(next);
      }
      return;
    }

    const arrowIndex = resolveTabListKeyAction(event.key, focusedIndex, flatItems.length);
    if (arrowIndex !== null) {
      event.preventDefault();
      focusItem(arrowIndex);
    }
  };

  if (flatItems.length === 0) {
    return null;
  }

  return portalToBody(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Tab actions"
      className="hc-tab-context-menu app-no-drag fixed z-[70] min-w-[200px] rounded-md border border-separator bg-surface py-1 shadow-md"
      style={{ left: clampedPosition.x, top: clampedPosition.y }}
      onKeyDown={handleMenuKeyDown}
    >
      {groups.map((group, groupIndex) => {
        let flatIndex = groups
          .slice(0, groupIndex)
          .reduce((count, groupItems) => count + groupItems.length, 0);

        return (
          <div
            key={groupIndex}
            className={
              groupIndex > 0
                ? 'hc-tab-context-menu-group border-t border-separator'
                : 'hc-tab-context-menu-group'
            }
          >
            {group.map((item) => {
              const itemIndex = flatIndex++;
              const disabled = !isMenuItemEnabled(item);
              return (
                <button
                  key={item.label}
                  ref={(element) => {
                    itemRefs.current[itemIndex] = element;
                  }}
                  type="button"
                  role="menuitem"
                  disabled={disabled}
                  tabIndex={itemIndex === focusedIndex && !disabled ? 0 : -1}
                  className={cn('hc-tab-context-menu-item', menuItemClass(item.variant, disabled))}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (disabled) {
                      return;
                    }
                    closeMenu();
                    item.onSelect?.();
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
