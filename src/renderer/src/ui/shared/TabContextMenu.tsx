import { resolveTabListKeyAction, type MenuItem } from '@harborclient/sdk/components';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { JSX, KeyboardEvent } from 'react';

interface Position {
  /**
   * Viewport X coordinate where the menu was opened.
   */
  x: number;

  /**
   * Viewport Y coordinate where the menu was opened.
   */
  y: number;
}

interface Props {
  /**
   * Grouped menu entries. Each inner array is one visual group separated by a divider.
   */
  groups: MenuItem[][];

  /**
   * Cursor position used to anchor the menu panel.
   */
  position: Position;

  /**
   * Called when the menu should close without selecting an item.
   */
  onClose: () => void;
}

/**
 * Tailwind classes for a single menu item button.
 *
 * @param variant - Visual variant for default or destructive actions.
 */
function menuItemClass(variant: MenuItem['variant']): string {
  const base =
    'block w-full cursor-pointer border-none bg-transparent px-3.5 py-1.5 text-left text-[16px] app-no-drag';

  return variant === 'danger'
    ? `${base} text-text hover:bg-danger/15 hover:text-danger`
    : `${base} text-text hover:bg-selection`;
}

/**
 * Clamps a menu position so the panel stays fully inside the viewport.
 *
 * @param position - Requested top-left coordinates.
 * @param size - Measured menu width and height.
 */
function clampMenuPosition(position: Position, size: { width: number; height: number }): Position {
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - size.width - margin);
  const maxY = Math.max(margin, window.innerHeight - size.height - margin);
  return {
    x: Math.min(Math.max(position.x, margin), maxX),
    y: Math.min(Math.max(position.y, margin), maxY)
  };
}

/**
 * Cursor-positioned context menu for tab bars, rendered in a portal at the click point.
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
   * Re-clamps the menu after mount and focuses the first item once dimensions are known.
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
    itemRefs.current[0]?.focus();
  }, [position, groups]);

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

    const arrowIndex = resolveTabListKeyAction(event.key, focusedIndex, flatItems.length);
    if (arrowIndex !== null) {
      event.preventDefault();
      focusItem(arrowIndex);
    }
  };

  if (flatItems.length === 0) {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Tab actions"
      className="hc-tab-context-menu app-no-drag fixed z-50 min-w-[200px] rounded-md border border-separator bg-surface py-1 shadow-md"
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
              return (
                <button
                  key={item.label}
                  ref={(element) => {
                    itemRefs.current[itemIndex] = element;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={itemIndex === focusedIndex ? 0 : -1}
                  className={`hc-tab-context-menu-item ${menuItemClass(item.variant)}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    closeMenu();
                    item.onSelect();
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>,
    document.body
  );
}
