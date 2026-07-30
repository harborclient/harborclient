import { faCaretRight, faCheck } from '@fortawesome/free-solid-svg-icons';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from '@harborclient/sdk/react';
import type { JSX, KeyboardEvent } from 'react';
import { FaIcon } from '../FaIcon/index.js';
import { Submenu } from '../RowActionsMenu/Submenu.js';
import type { MenuItem } from '../RowActionsMenu/index.js';
import { MENU_MIN_WIDTH_PX, type MenuPosition, clampMenuPosition } from '../menuPosition.js';
import { portalToBody } from '../portalToBody.js';
import {
  findAdjacentEnabledIndex,
  findEdgeEnabledIndex,
  isMenuItemEnabled,
  menuItemClass
} from '../rowActionsMenuHelpers.js';
import { cn, resolveMenuTypeahead } from '../utils.js';

interface Props {
  /**
   * Grouped menu entries. Each inner array is one visual group separated by a divider.
   */
  groups: MenuItem[][];

  /**
   * Host viewport coordinates for the panel top-left corner (before clamping).
   */
  anchor: MenuPosition;

  /**
   * Called when the menu dismisses (outside click, Escape, Tab, or item select).
   */
  onDismiss: () => void;

  /**
   * Unique id for this menu instance (used for a11y ids). Defaults to `anchor-menu`.
   */
  menuId?: string;

  /**
   * Optional class names merged onto the portaled panel.
   */
  className?: string;
}

const TYPEAHEAD_TIMEOUT_MS = 500;

/** Delay before a hovered row's submenu opens. */
const SUBMENU_OPEN_DELAY_MS = 120;

/** Delay before a submenu closes after the pointer leaves its row and panel. */
const SUBMENU_CLOSE_DELAY_MS = 200;

/**
 * Portaled context menu panel anchored to viewport coordinates (no hamburger trigger).
 *
 * Used by the host for plugin-requested entity menus (`showEntityContextMenu`) and any
 * other cursor-anchored menu that should match {@link RowActionsMenu} keyboard and
 * submenu behavior without owning a row trigger button.
 */
export function AnchorMenuPanel({
  groups,
  anchor,
  onDismiss,
  menuId = 'anchor-menu',
  className
}: Props): JSX.Element | null {
  const menuElementId = `${menuId}-menu`;
  const submenuElementId = `${menuId}-submenu`;
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const typeaheadBuffer = useRef('');
  const typeaheadTimer = useRef<number | null>(null);
  const submenuOpenTimer = useRef<number | null>(null);
  const submenuCloseTimer = useRef<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>(anchor);
  const [openSubmenuIndex, setOpenSubmenuIndex] = useState<number | null>(null);
  /**
   * Flattens grouped items once for keyboard navigation and typeahead.
   */
  const flatItems = useMemo(() => groups.flat(), [groups]);
  /**
   * Labels used by typeahead matching.
   */
  const itemLabels = useMemo(() => flatItems.map((item) => item.label), [flatItems]);
  /**
   * Whether any item can receive focus / activation.
   */
  const hasEnabledItems = useMemo(
    () => flatItems.some((item) => isMenuItemEnabled(item)),
    [flatItems]
  );

  /**
   * Clears the accumulated typeahead buffer.
   */
  const clearTypeahead = useCallback((): void => {
    typeaheadBuffer.current = '';
    if (typeaheadTimer.current != null) {
      window.clearTimeout(typeaheadTimer.current);
      typeaheadTimer.current = null;
    }
  }, []);

  /**
   * Cancels any pending submenu open/close timers.
   */
  const clearSubmenuTimers = useCallback((): void => {
    if (submenuOpenTimer.current != null) {
      window.clearTimeout(submenuOpenTimer.current);
      submenuOpenTimer.current = null;
    }
    if (submenuCloseTimer.current != null) {
      window.clearTimeout(submenuCloseTimer.current);
      submenuCloseTimer.current = null;
    }
  }, []);

  /**
   * Dismisses the menu and clears transient keyboard/submenu state.
   */
  const dismiss = useCallback((): void => {
    clearTypeahead();
    clearSubmenuTimers();
    onDismiss();
  }, [clearSubmenuTimers, clearTypeahead, onDismiss]);

  /**
   * Opens the submenu belonging to the item at `index` immediately.
   *
   * @param index - Flat item index that owns a submenu.
   */
  const openSubmenuAt = useCallback(
    (index: number): void => {
      clearSubmenuTimers();
      setOpenSubmenuIndex(index);
    },
    [clearSubmenuTimers]
  );

  /**
   * Closes the currently open submenu and returns focus to its parent row.
   */
  const closeSubmenuAndRefocus = useCallback((): void => {
    clearSubmenuTimers();
    setOpenSubmenuIndex((current) => {
      if (current != null) {
        requestAnimationFrame(() => {
          itemRefs.current[current]?.focus();
        });
      }
      return null;
    });
  }, [clearSubmenuTimers]);

  /**
   * Schedules opening the submenu at `index` after a short hover-intent delay.
   *
   * @param index - Flat item index that owns a submenu.
   */
  const scheduleOpenSubmenu = useCallback(
    (index: number): void => {
      clearSubmenuTimers();
      submenuOpenTimer.current = window.setTimeout(() => {
        submenuOpenTimer.current = null;
        setOpenSubmenuIndex(index);
      }, SUBMENU_OPEN_DELAY_MS);
    },
    [clearSubmenuTimers]
  );

  /**
   * Schedules closing the open submenu after a short delay.
   */
  const scheduleCloseSubmenu = useCallback((): void => {
    if (submenuOpenTimer.current != null) {
      window.clearTimeout(submenuOpenTimer.current);
      submenuOpenTimer.current = null;
    }
    submenuCloseTimer.current = window.setTimeout(() => {
      submenuCloseTimer.current = null;
      setOpenSubmenuIndex(null);
    }, SUBMENU_CLOSE_DELAY_MS);
  }, []);

  /**
   * Handles pointer hover over a row: opens that row's submenu or schedules close.
   *
   * @param item - Menu item under the pointer.
   * @param itemIndex - Flat index of that item.
   */
  const handleItemMouseEnter = useCallback(
    (item: MenuItem, itemIndex: number): void => {
      if (item.submenu) {
        if (openSubmenuIndex === itemIndex) {
          clearSubmenuTimers();
        } else if (openSubmenuIndex != null) {
          openSubmenuAt(itemIndex);
        } else {
          scheduleOpenSubmenu(itemIndex);
        }
        return;
      }

      if (openSubmenuIndex != null) {
        scheduleCloseSubmenu();
      } else {
        clearSubmenuTimers();
      }
    },
    [clearSubmenuTimers, openSubmenuAt, openSubmenuIndex, scheduleCloseSubmenu, scheduleOpenSubmenu]
  );

  /**
   * Focuses a menu item by index and updates roving tabindex state.
   *
   * @param index - Flat item index to focus.
   */
  const focusItem = useCallback((index: number): void => {
    setFocusedIndex(index);
    requestAnimationFrame(() => {
      itemRefs.current[index]?.focus();
    });
  }, []);

  /**
   * Clamps the panel so it stays fully inside the viewport using measured size.
   */
  const updateMenuPosition = useCallback((): void => {
    const panelRect = panelRef.current?.getBoundingClientRect();
    const menuSize = {
      width: panelRect?.width ?? MENU_MIN_WIDTH_PX,
      height: panelRect?.height ?? 0
    };
    if (menuSize.height > 0) {
      setMenuPosition(clampMenuPosition(anchor, menuSize));
      return;
    }
    setMenuPosition(anchor);
  }, [anchor]);

  /**
   * Focuses the first enabled item after mount, or the panel itself when the
   * menu only contains disabled placeholders (empty-state rows).
   */
  useEffect(() => {
    if (flatItems.length === 0) {
      return;
    }
    if (!hasEnabledItems) {
      requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
      return;
    }
    const edgeIndex = findEdgeEnabledIndex(flatItems, false);
    if (edgeIndex == null) {
      return;
    }
    setFocusedIndex(edgeIndex);
    requestAnimationFrame(() => {
      itemRefs.current[edgeIndex]?.focus();
    });
  }, [flatItems, hasEnabledItems]);

  /**
   * Re-clamps the portaled menu after mount once panel dimensions are known.
   */
  useLayoutEffect(() => {
    updateMenuPosition();
  }, [groups, updateMenuPosition]);

  /**
   * Re-clamps on scroll/resize while the panel is open.
   */
  useEffect(() => {
    updateMenuPosition();
    window.addEventListener('scroll', updateMenuPosition, true);
    window.addEventListener('resize', updateMenuPosition);
    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [updateMenuPosition]);

  /**
   * Dismisses on outside click; Escape closes submenu first, then the panel.
   */
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        document.getElementById(submenuElementId)?.contains(target)
      ) {
        return;
      }
      dismiss();
    };

    const handleKeyDown = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (openSubmenuIndex != null) {
          closeSubmenuAndRefocus();
        } else {
          dismiss();
        }
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeSubmenuAndRefocus, dismiss, openSubmenuIndex, submenuElementId]);

  /**
   * Clears timers on unmount.
   */
  useEffect(() => {
    return () => {
      clearTypeahead();
      clearSubmenuTimers();
    };
  }, [clearSubmenuTimers, clearTypeahead]);

  /**
   * Handles keyboard navigation within the open menu.
   *
   * @param event - Keyboard event from the menu panel.
   */
  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Tab') {
      dismiss();
      return;
    }

    if (!hasEnabledItems) {
      return;
    }

    if (event.key === 'ArrowRight') {
      const candidate = flatItems[focusedIndex];
      if (candidate?.submenu) {
        event.preventDefault();
        openSubmenuAt(focusedIndex);
      }
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = findAdjacentEnabledIndex(flatItems, focusedIndex, direction);
      if (nextIndex != null) {
        event.preventDefault();
        clearTypeahead();
        focusItem(nextIndex);
      }
      return;
    }

    if (event.key === 'Home') {
      const firstIndex = findEdgeEnabledIndex(flatItems, false);
      if (firstIndex != null) {
        event.preventDefault();
        clearTypeahead();
        focusItem(firstIndex);
      }
      return;
    }

    if (event.key === 'End') {
      const lastIndex = findEdgeEnabledIndex(flatItems, true);
      if (lastIndex != null) {
        event.preventDefault();
        clearTypeahead();
        focusItem(lastIndex);
      }
      return;
    }

    const typeahead = resolveMenuTypeahead(
      itemLabels,
      focusedIndex,
      event.key,
      typeaheadBuffer.current
    );
    if (typeahead) {
      const candidate = flatItems[typeahead.index];
      if (!candidate || !isMenuItemEnabled(candidate)) {
        return;
      }
      event.preventDefault();
      typeaheadBuffer.current = typeahead.buffer;
      if (typeaheadTimer.current != null) {
        window.clearTimeout(typeaheadTimer.current);
      }
      typeaheadTimer.current = window.setTimeout(() => {
        typeaheadBuffer.current = '';
        typeaheadTimer.current = null;
      }, TYPEAHEAD_TIMEOUT_MS);
      focusItem(typeahead.index);
    }
  };

  if (flatItems.length === 0) {
    return null;
  }

  const openSubmenuItem = openSubmenuIndex != null ? flatItems[openSubmenuIndex] : undefined;
  const openSubmenuAnchorRect =
    openSubmenuIndex != null ? itemRefs.current[openSubmenuIndex]?.getBoundingClientRect() : null;

  const menuPanel = (
    <div
      ref={panelRef}
      id={menuElementId}
      role="menu"
      tabIndex={hasEnabledItems ? undefined : -1}
      className={cn(
        'hc-anchor-menu-panel hc-row-actions-menu-panel app-no-drag fixed z-50 min-w-[200px] rounded-md border border-separator bg-surface py-1 shadow-md',
        className
      )}
      style={{ left: menuPosition.x, top: menuPosition.y }}
      onKeyDown={handleMenuKeyDown}
      onMouseLeave={() => {
        if (openSubmenuIndex != null) {
          scheduleCloseSubmenu();
        }
      }}
    >
      {groups.map((group, groupIndex) => {
        let flatIndex = groups.slice(0, groupIndex).reduce((count, g) => count + g.length, 0);

        return (
          <div
            key={groupIndex}
            className={
              groupIndex > 0
                ? 'hc-row-actions-menu-group border-t border-separator'
                : 'hc-row-actions-menu-group'
            }
          >
            {group.map((item) => {
              const itemIndex = flatIndex++;
              const isCheckboxItem = item.checked !== undefined;
              const isDisabled = item.disabled === true;
              const hasSubmenu = item.submenu !== undefined;
              return (
                <button
                  key={item.label}
                  ref={(el) => {
                    itemRefs.current[itemIndex] = isDisabled ? null : el;
                  }}
                  type="button"
                  role={isCheckboxItem ? 'menuitemcheckbox' : 'menuitem'}
                  aria-checked={isCheckboxItem ? item.checked : undefined}
                  aria-disabled={isDisabled || undefined}
                  aria-haspopup={hasSubmenu ? 'menu' : undefined}
                  aria-expanded={hasSubmenu ? openSubmenuIndex === itemIndex : undefined}
                  aria-controls={
                    hasSubmenu && openSubmenuIndex === itemIndex ? submenuElementId : undefined
                  }
                  disabled={isDisabled}
                  tabIndex={isDisabled ? -1 : itemIndex === focusedIndex ? 0 : -1}
                  className={cn(
                    'hc-row-actions-menu-item',
                    menuItemClass(item.variant, isDisabled)
                  )}
                  onMouseEnter={() => {
                    if (!isDisabled) {
                      handleItemMouseEnter(item, itemIndex);
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isDisabled) {
                      return;
                    }
                    if (item.submenu) {
                      if (openSubmenuIndex === itemIndex) {
                        closeSubmenuAndRefocus();
                      } else {
                        openSubmenuAt(itemIndex);
                      }
                      return;
                    }
                    dismiss();
                    item.onSelect();
                  }}
                >
                  {isCheckboxItem ? (
                    <span
                      className="hc-row-actions-menu-item-check inline-flex w-4 shrink-0 justify-center"
                      aria-hidden
                    >
                      {item.checked ? <FaIcon icon={faCheck} className="h-3 w-3" /> : null}
                    </span>
                  ) : null}
                  <span className="hc-row-actions-menu-item-label min-w-0">{item.label}</span>
                  {hasSubmenu ? (
                    <FaIcon icon={faCaretRight} className="ml-auto h-3 w-3 shrink-0" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  const submenuPanel =
    openSubmenuItem?.submenu && openSubmenuAnchorRect ? (
      <Submenu
        groups={openSubmenuItem.submenu}
        anchorRect={openSubmenuAnchorRect}
        menuElementId={submenuElementId}
        onSelectItem={(item) => {
          dismiss();
          item.onSelect?.();
        }}
        onRequestClose={closeSubmenuAndRefocus}
        onCloseAll={dismiss}
        onMouseEnter={clearSubmenuTimers}
        onMouseLeave={scheduleCloseSubmenu}
      />
    ) : null;

  return (
    <>
      {portalToBody(menuPanel)}
      {submenuPanel}
    </>
  );
}
