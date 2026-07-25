import { faCheck } from '@fortawesome/free-solid-svg-icons';
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
import {
  MENU_MIN_WIDTH_PX,
  type MenuPosition,
  clampMenuPosition,
  getSubmenuAnchoredPosition
} from '../menuPosition.js';
import { portalToBody } from '../portalToBody.js';
import {
  findAdjacentEnabledIndex,
  findEdgeEnabledIndex,
  isMenuItemEnabled,
  menuItemClass
} from '../rowActionsMenuHelpers.js';
import { cn, resolveMenuTypeahead } from '../utils.js';
import type { MenuItem } from './index.js';

/** Milliseconds before an accumulated typeahead search resets. */
const TYPEAHEAD_TIMEOUT_MS = 500;

interface Props {
  /**
   * Grouped flyout entries, mirroring `RowActionsMenu`'s `groups` shape.
   */
  groups: MenuItem[][];

  /**
   * Bounding rect of the parent row that anchors this flyout.
   */
  anchorRect: DOMRect;

  /**
   * Id applied to the flyout panel for `aria-controls` on the anchor row.
   */
  menuElementId: string;

  /**
   * Called when a leaf item is activated. The caller is responsible for
   * closing the whole menu tree and invoking the item's `onSelect`.
   */
  onSelectItem: (item: MenuItem) => void;

  /**
   * Closes just this flyout and returns focus to the anchor row.
   */
  onRequestClose: () => void;

  /**
   * Closes the entire menu tree, e.g. when the user tabs out.
   */
  onCloseAll: () => void;

  /**
   * Forwarded so the parent can cancel a pending auto-close while the
   * pointer is over the flyout panel itself.
   */
  onMouseEnter: () => void;

  /**
   * Forwarded so the parent can schedule closing this flyout once the
   * pointer leaves the panel.
   */
  onMouseLeave: () => void;
}

/**
 * Flyout panel opened beside a `RowActionsMenu` row that has a `submenu`.
 * Portaled to `document.body` with fixed positioning, matching the main
 * panel's styling and keyboard behavior (roving tabindex, typeahead,
 * Home/End). `ArrowLeft` and `Tab` bubble a close request to the parent
 * instead of being handled locally.
 */
export function Submenu({
  groups,
  anchorRect,
  menuElementId,
  onSelectItem,
  onRequestClose,
  onCloseAll,
  onMouseEnter,
  onMouseLeave
}: Props): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const typeaheadBuffer = useRef('');
  const typeaheadTimer = useRef<number | null>(null);
  const flatItems = useMemo(() => groups.flat(), [groups]);
  const itemLabels = useMemo(() => flatItems.map((item) => item.label), [flatItems]);
  const [focusedIndex, setFocusedIndex] = useState(
    () => findEdgeEnabledIndex(flatItems, false) ?? 0
  );
  const [position, setPosition] = useState<MenuPosition>(() =>
    getSubmenuAnchoredPosition(anchorRect, { width: MENU_MIN_WIDTH_PX, height: 0 })
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
   * Focuses a flyout item by index and updates roving tabindex state.
   */
  const focusItem = useCallback((index: number): void => {
    setFocusedIndex(index);
    requestAnimationFrame(() => {
      itemRefs.current[index]?.focus();
    });
  }, []);

  /**
   * Moves focus into the flyout as soon as it mounts.
   */
  useEffect(() => {
    requestAnimationFrame(() => {
      itemRefs.current[focusedIndex]?.focus();
    });
    // Intentionally runs once on mount; the flyout is remounted per anchor,
    // so `focusedIndex` never needs to re-trigger this effect.
  }, []);

  /**
   * Positions the flyout beside the anchor row once its size is known,
   * flipping sides and clamping so it stays inside the viewport.
   */
  useLayoutEffect(() => {
    const panelRect = panelRef.current?.getBoundingClientRect();
    const size = {
      width: panelRect?.width ?? MENU_MIN_WIDTH_PX,
      height: panelRect?.height ?? 0
    };
    const requested = getSubmenuAnchoredPosition(anchorRect, size);
    setPosition(size.height > 0 ? clampMenuPosition(requested, size) : requested);
  }, [anchorRect, groups]);

  /**
   * Handles keyboard navigation within the flyout. `ArrowLeft` and `Tab`
   * stop propagation and delegate closing to the parent, since the parent
   * panel would otherwise also react to the bubbled event.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      onCloseAll();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      onRequestClose();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = findAdjacentEnabledIndex(flatItems, focusedIndex, direction);
      if (nextIndex != null) {
        event.preventDefault();
        event.stopPropagation();
        clearTypeahead();
        focusItem(nextIndex);
      }
      return;
    }

    if (event.key === 'Home') {
      const firstIndex = findEdgeEnabledIndex(flatItems, false);
      if (firstIndex != null) {
        event.preventDefault();
        event.stopPropagation();
        clearTypeahead();
        focusItem(firstIndex);
      }
      return;
    }

    if (event.key === 'End') {
      const lastIndex = findEdgeEnabledIndex(flatItems, true);
      if (lastIndex != null) {
        event.preventDefault();
        event.stopPropagation();
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
      event.stopPropagation();
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

  return portalToBody(
    <div
      ref={panelRef}
      id={menuElementId}
      role="menu"
      className="hc-row-actions-menu-panel hc-row-actions-submenu-panel app-no-drag fixed z-50 min-w-[200px] rounded-md border border-separator bg-surface py-1 shadow-md"
      style={{ left: position.x, top: position.y }}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
                  disabled={isDisabled}
                  tabIndex={isDisabled ? -1 : itemIndex === focusedIndex ? 0 : -1}
                  className={cn(
                    'hc-row-actions-menu-item',
                    menuItemClass(item.variant, isDisabled)
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isDisabled) {
                      return;
                    }
                    onSelectItem(item);
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
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
