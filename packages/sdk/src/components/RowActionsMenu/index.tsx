import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faBars, faCaretRight, faCheck } from '@fortawesome/free-solid-svg-icons';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from '@harborclient/sdk/react';
import type { ComponentPropsWithoutRef, JSX, KeyboardEvent, ReactNode } from 'react';
import { Button, type ButtonVariant } from '../Button/index.js';
import { FaIcon } from '../FaIcon/index.js';
import {
  MENU_MIN_WIDTH_PX,
  type MenuPosition,
  clampMenuPosition,
  getTriggerAnchoredMenuPosition
} from '../menuPosition.js';
import { portalToBody } from '../portalToBody.js';
import {
  findAdjacentEnabledIndex,
  findEdgeEnabledIndex,
  isMenuItemEnabled,
  menuItemClass
} from '../rowActionsMenuHelpers.js';
import { cn, resolveMenuTypeahead } from '../utils.js';
import { Submenu } from './Submenu.js';

interface MenuItemBase {
  label: string;
  variant?: 'default' | 'danger';

  /**
   * When set, renders the item as a checkbox-style menu entry with a leading
   * checkmark slot. `true` shows the check; `false` reserves the slot for alignment.
   */
  checked?: boolean;

  /**
   * When true, renders a non-interactive informational row excluded from keyboard
   * focus and activation.
   */
  disabled?: boolean;
}

/**
 * A single row in a `RowActionsMenu`. An item is either a leaf action that
 * runs `onSelect`, or a parent that opens a `submenu` flyout beside it (shown
 * with a trailing caret) — never both.
 */
export type MenuItem =
  | (MenuItemBase & { onSelect: () => void; submenu?: undefined })
  | (MenuItemBase & {
      onSelect?: undefined;

      /**
       * Grouped entries shown in a flyout beside this row when it is hovered,
       * clicked, or activated with `ArrowRight`/`Enter`.
       */
      submenu: MenuItem[][];
    });

interface Props extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  /**
   * Grouped menu entries shown when the trigger is open. Each inner array is
   * one visual group separated by a divider line.
   */
  groups: MenuItem[][];

  /**
   * Unique id for this menu instance (e.g. "collection-3").
   */
  menuId: string;

  /**
   * Id of the currently open menu, or null when all are closed.
   */
  openMenuId: string | null;

  /**
   * Called when the user opens or closes a menu.
   */
  onOpenChange: (id: string | null) => void;

  /**
   * Visual style for the menu trigger button. Defaults to `icon` (hamburger).
   */
  triggerVariant?: ButtonVariant;

  /**
   * Optional label rendered beside the trigger icon. When set, the trigger
   * switches from icon-only to a labeled control.
   */
  triggerLabel?: ReactNode;

  /**
   * Icon shown in the trigger. Defaults to the hamburger icon.
   */
  triggerIcon?: IconDefinition;

  /**
   * Accessible name for the trigger. Defaults to "Row actions" for icon-only
   * triggers or `triggerLabel` when a label is provided.
   */
  triggerAriaLabel?: string;

  /**
   * Tooltip for the trigger button.
   */
  triggerTitle?: string;

  /**
   * Additional classes merged onto the trigger button.
   */
  triggerClassName?: string;

  /**
   * Whether the menu opens below or above the trigger. Defaults to opening downward.
   */
  placement?: 'down' | 'up';
}

const TYPEAHEAD_TIMEOUT_MS = 500;

/** Delay before a hovered row's submenu opens, so passing over rows doesn't flash flyouts. */
const SUBMENU_OPEN_DELAY_MS = 120;

/** Delay before a submenu closes after the pointer leaves its row and panel. */
const SUBMENU_CLOSE_DELAY_MS = 200;

/**
 * Hamburger-triggered dropdown for row-level actions (rename, delete, etc.).
 *
 * The menu panel is portaled to `document.body` with fixed positioning so it is
 * not clipped by overflow-hidden sidebar or scroll containers. Items with a
 * `submenu` open a nested flyout panel beside them on hover, click, or
 * `ArrowRight`/`Enter`.
 */
export function RowActionsMenu({
  groups,
  menuId,
  openMenuId,
  onOpenChange,
  triggerVariant,
  triggerLabel,
  triggerIcon = faBars,
  triggerAriaLabel,
  triggerTitle,
  triggerClassName,
  placement = 'down',
  className,
  ...props
}: Props): JSX.Element {
  const isOpen = openMenuId === menuId;
  const menuElementId = `${menuId}-menu`;
  const submenuElementId = `${menuId}-submenu`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const typeaheadBuffer = useRef('');
  const typeaheadTimer = useRef<number | null>(null);
  const wasOpenRef = useRef(isOpen);
  const submenuOpenTimer = useRef<number | null>(null);
  const submenuCloseTimer = useRef<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const [openSubmenuIndex, setOpenSubmenuIndex] = useState<number | null>(null);
  const flatItems = useMemo(() => groups.flat(), [groups]);
  const itemLabels = useMemo(() => flatItems.map((item) => item.label), [flatItems]);
  const hasEnabledItems = useMemo(
    () => flatItems.some((item) => isMenuItemEnabled(item)),
    [flatItems]
  );
  const isLabeledTrigger = triggerLabel != null;
  const resolvedTriggerVariant = triggerVariant ?? (isLabeledTrigger ? 'secondary' : 'icon');
  const resolvedTriggerTitle = triggerTitle ?? (isLabeledTrigger ? undefined : 'Actions');
  const resolvedTriggerAriaLabel =
    triggerAriaLabel ??
    (typeof triggerLabel === 'string' ? triggerLabel : isLabeledTrigger ? 'Menu' : 'Row actions');

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
   * Closes the menu and returns focus to the trigger button.
   */
  const closeMenu = useCallback((): void => {
    clearTypeahead();
    clearSubmenuTimers();
    onOpenChange(null);
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, [clearSubmenuTimers, clearTypeahead, onOpenChange]);

  /**
   * Opens the submenu belonging to the item at `index` immediately, canceling
   * any pending open/close timers.
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
   * Schedules opening the submenu at `index` after a short hover-intent
   * delay, so moving the pointer across sibling rows doesn't flash flyouts.
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
   * Schedules closing the open submenu after a short delay, giving the
   * pointer time to travel from the row into the flyout panel.
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
   * Handles pointer hover over a row: opens that row's submenu (immediately
   * if a different submenu is already open, otherwise after a short delay),
   * or schedules closing the open submenu when hovering a row without one.
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
   */
  const focusItem = useCallback((index: number): void => {
    setFocusedIndex(index);
    requestAnimationFrame(() => {
      itemRefs.current[index]?.focus();
    });
  }, []);

  /**
   * Opens the menu and focuses the first or last item.
   */
  const openMenu = useCallback(
    (focusLast = false): void => {
      if (!hasEnabledItems) return;
      const edgeIndex = findEdgeEnabledIndex(flatItems, focusLast);
      if (edgeIndex == null) return;
      setFocusedIndex(edgeIndex);
      onOpenChange(menuId);
    },
    [flatItems, hasEnabledItems, menuId, onOpenChange]
  );

  /**
   * Updates fixed menu coordinates from the trigger and measured panel size.
   */
  const updateMenuPosition = useCallback((): void => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panelRef.current?.getBoundingClientRect();
    const menuSize = {
      width: panelRect?.width ?? MENU_MIN_WIDTH_PX,
      height: panelRect?.height ?? 0
    };
    const requested = getTriggerAnchoredMenuPosition(triggerRect, menuSize, placement);

    if (menuSize.height > 0) {
      setMenuPosition(clampMenuPosition(requested, menuSize));
      return;
    }

    setMenuPosition(requested);
  }, [placement]);

  /**
   * Moves focus into the menu after it opens and item refs are mounted.
   */
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      requestAnimationFrame(() => {
        itemRefs.current[focusedIndex]?.focus();
      });
    }
    wasOpenRef.current = isOpen;
  }, [focusedIndex, isOpen]);

  /**
   * Resets item refs and submenu state when the menu closes.
   */
  useEffect(() => {
    if (!isOpen) {
      itemRefs.current = [];
      setFocusedIndex(0);
      setOpenSubmenuIndex(null);
      clearTypeahead();
      clearSubmenuTimers();
    }
  }, [clearSubmenuTimers, clearTypeahead, isOpen]);

  /**
   * Re-clamps the portaled menu after mount once panel dimensions are known.
   */
  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    updateMenuPosition();
  }, [groups, isOpen, updateMenuPosition]);

  /**
   * Tracks trigger movement while the menu is open so fixed coordinates stay aligned.
   */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updateMenuPosition();
    window.addEventListener('scroll', updateMenuPosition, true);
    window.addEventListener('resize', updateMenuPosition);

    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [isOpen, updateMenuPosition]);

  /**
   * Closes the menu on outside click, and closes the open submenu (or, if
   * none is open, the whole menu) on Escape, while the menu is open.
   */
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target) ||
        document.getElementById(submenuElementId)?.contains(target)
      ) {
        return;
      }
      closeMenu();
    };

    const handleKeyDown = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (openSubmenuIndex != null) {
          closeSubmenuAndRefocus();
        } else {
          closeMenu();
        }
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMenu, closeSubmenuAndRefocus, isOpen, openSubmenuIndex, submenuElementId]);

  /**
   * Handles keyboard interaction on the menu trigger when closed.
   */
  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (isOpen) return;

    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu(false);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(true);
    }
  };

  /**
   * Handles keyboard navigation within the open menu. Arrow/Home/End/typeahead
   * are ignored while a submenu has focus, since `Submenu` stops propagation
   * for the keys it handles itself.
   */
  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!hasEnabledItems) return;

    if (event.key === 'Tab') {
      closeMenu();
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

  const openSubmenuItem = openSubmenuIndex != null ? flatItems[openSubmenuIndex] : undefined;
  const openSubmenuAnchorRect =
    openSubmenuIndex != null ? itemRefs.current[openSubmenuIndex]?.getBoundingClientRect() : null;

  const menuPanel = isOpen ? (
    <div
      ref={panelRef}
      id={menuElementId}
      role="menu"
      className="hc-row-actions-menu-panel app-no-drag fixed z-50 min-w-[200px] rounded-md border border-separator bg-surface py-1 shadow-md"
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
                    closeMenu();
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
  ) : null;

  const submenuPanel =
    openSubmenuItem?.submenu && openSubmenuAnchorRect ? (
      <Submenu
        groups={openSubmenuItem.submenu}
        anchorRect={openSubmenuAnchorRect}
        menuElementId={submenuElementId}
        onSelectItem={(item) => {
          closeMenu();
          item.onSelect?.();
        }}
        onRequestClose={closeSubmenuAndRefocus}
        onCloseAll={closeMenu}
        onMouseEnter={clearSubmenuTimers}
        onMouseLeave={scheduleCloseSubmenu}
      />
    ) : null;

  const labeledTriggerVariant =
    resolvedTriggerVariant === 'icon' || resolvedTriggerVariant === 'iconDanger'
      ? 'secondary'
      : resolvedTriggerVariant;

  const triggerButton = isLabeledTrigger ? (
    <Button
      innerRef={triggerRef}
      type="button"
      variant={labeledTriggerVariant as Exclude<ButtonVariant, 'icon' | 'iconDanger'>}
      className={cn('hc-row-actions-menu-trigger', triggerClassName)}
      title={resolvedTriggerTitle}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-controls={isOpen ? menuElementId : undefined}
      onClick={(e) => {
        e.stopPropagation();
        if (isOpen) {
          closeMenu();
        } else {
          openMenu(false);
        }
      }}
      onKeyDown={handleTriggerKeyDown}
    >
      <FaIcon icon={triggerIcon} className="h-[1em] w-[1em] shrink-0" aria-hidden />
      <span className="hc-row-actions-menu-trigger-label inline-flex min-w-0 flex-1 items-center truncate overflow-hidden leading-none">
        {triggerLabel}
      </span>
    </Button>
  ) : (
    <Button
      innerRef={triggerRef}
      type="button"
      variant="icon"
      className={cn('hc-row-actions-menu-trigger', triggerClassName)}
      title={resolvedTriggerTitle}
      aria-label={resolvedTriggerAriaLabel}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-controls={isOpen ? menuElementId : undefined}
      onClick={(e) => {
        e.stopPropagation();
        if (isOpen) {
          closeMenu();
        } else {
          openMenu(false);
        }
      }}
      onKeyDown={handleTriggerKeyDown}
    >
      <FaIcon icon={triggerIcon} className="h-3.5 w-3.5" />
    </Button>
  );

  return (
    <div ref={rootRef} {...props} className={cn('hc-row-actions-menu shrink-0', className)}>
      {triggerButton}
      {menuPanel ? portalToBody(menuPanel) : null}
      {submenuPanel}
    </div>
  );
}
