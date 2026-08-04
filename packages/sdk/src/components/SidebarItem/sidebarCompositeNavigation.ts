import type { FocusEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { resolveTabListKeyAction } from '../utils.js';

/**
 * Role used by flat sidebar item lists.
 */
export const SIDEBAR_LISTBOX_ITEM_ROLE = 'option';

/**
 * Role used by nested sidebar item trees.
 */
export const SIDEBAR_TREE_ITEM_ROLE = 'treeitem';

/**
 * Collects composite items under a listbox or tree root in DOM order.
 *
 * @param root - Listbox or tree element.
 * @param role - Item role to collect (`option` or `treeitem`).
 * @returns Focusable item elements in document order.
 */
export function querySidebarCompositeItems(
  root: ParentNode,
  role: typeof SIDEBAR_LISTBOX_ITEM_ROLE | typeof SIDEBAR_TREE_ITEM_ROLE
): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[role="${role}"]`)).filter((element) => {
    // Nested listboxes/trees can appear in plugin hosts; keep items local to this root.
    const owner =
      role === SIDEBAR_LISTBOX_ITEM_ROLE
        ? element.closest('[role="listbox"]')
        : element.closest('[role="tree"]');
    return owner === root || (owner == null && root.contains(element));
  });
}

/**
 * Updates roving tabindex so exactly one composite item is a Tab stop.
 *
 * @param items - Composite items in order.
 * @param focusIndex - Index that should receive `tabIndex={0}`.
 */
export function setSidebarCompositeRovingTabIndex(
  items: readonly HTMLElement[],
  focusIndex: number
): void {
  items.forEach((item, index) => {
    item.tabIndex = index === focusIndex ? 0 : -1;
  });
}

/**
 * Resolves the index of the focused item, falling back to the current Tab stop.
 *
 * @param items - Composite items in order.
 * @param activeElement - Document active element, if any.
 * @returns Index into `items`, or `-1` when empty.
 */
export function resolveSidebarCompositeFocusIndex(
  items: readonly HTMLElement[],
  activeElement: Element | null
): number {
  if (items.length === 0) {
    return -1;
  }

  const focusedIndex = items.findIndex(
    (item) => item === activeElement || item.contains(activeElement)
  );
  if (focusedIndex >= 0) {
    return focusedIndex;
  }

  const tabStopIndex = items.findIndex((item) => item.tabIndex === 0);
  if (tabStopIndex >= 0) {
    return tabStopIndex;
  }

  return 0;
}

/**
 * Focuses a composite item and makes it the sole Tab stop.
 *
 * @param items - Composite items in order.
 * @param index - Target index.
 */
export function focusSidebarCompositeItem(items: readonly HTMLElement[], index: number): void {
  const target = items[index];
  if (target == null) {
    return;
  }

  setSidebarCompositeRovingTabIndex(items, index);
  target.focus();
  if (typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ block: 'nearest' });
  }
}

/**
 * Finds the expand/collapse control inside a treeitem, if present.
 *
 * @param item - Treeitem element.
 * @returns Chevron button, or null when the item is a leaf.
 */
export function findSidebarTreeExpandButton(item: HTMLElement): HTMLButtonElement | null {
  return item.querySelector<HTMLButtonElement>(
    'button[aria-expanded], button[aria-label^="Expand"], button[aria-label^="Collapse"]'
  );
}

/**
 * Whether the key event should open the focused row's actions menu.
 *
 * @param event - Keyboard event from a composite item or container.
 * @returns True for Shift+F10 or the ContextMenu key.
 */
export function isSidebarRowActionsMenuKey(
  event: Pick<KeyboardEvent | ReactKeyboardEvent, 'key' | 'shiftKey'>
): boolean {
  if (event.key === 'ContextMenu') {
    return true;
  }

  return event.key === 'F10' && event.shiftKey;
}

/**
 * Opens the row actions menu trigger inside a sidebar row, if present.
 *
 * @param row - Focused option or treeitem element.
 * @returns True when a trigger was found and activated.
 */
export function openSidebarRowActionsMenu(row: HTMLElement): boolean {
  const trigger =
    row.querySelector<HTMLButtonElement>('.hc-row-actions-menu-trigger') ??
    row.querySelector<HTMLButtonElement>('[data-sidebar-actions] button');

  if (trigger == null || trigger.disabled) {
    return false;
  }

  trigger.click();
  return true;
}

/**
 * Handles ArrowLeft / ArrowRight expand/collapse for a focused treeitem.
 *
 * @param event - Keydown event.
 * @param item - Focused treeitem.
 * @param items - All visible treeitems under the tree.
 * @param focusIndex - Index of `item` in `items`.
 * @returns True when the key was handled.
 */
export function handleSidebarTreeHorizontalKey(
  event: KeyboardEvent | ReactKeyboardEvent,
  item: HTMLElement,
  items: readonly HTMLElement[],
  focusIndex: number
): boolean {
  const expanded = item.getAttribute('aria-expanded');

  if (event.key === 'ArrowRight') {
    if (expanded === 'false') {
      const expandButton = findSidebarTreeExpandButton(item);
      if (expandButton != null) {
        event.preventDefault();
        expandButton.click();
        return true;
      }
    }

    if (expanded === 'true') {
      const next = items[focusIndex + 1];
      if (next != null) {
        event.preventDefault();
        focusSidebarCompositeItem(items, focusIndex + 1);
        return true;
      }
    }

    return false;
  }

  if (event.key === 'ArrowLeft') {
    if (expanded === 'true') {
      const collapseButton = findSidebarTreeExpandButton(item);
      if (collapseButton != null) {
        event.preventDefault();
        collapseButton.click();
        return true;
      }
    }

    const level = Number(item.getAttribute('aria-level') ?? '1');
    for (let index = focusIndex - 1; index >= 0; index -= 1) {
      const candidate = items[index];
      if (candidate == null) {
        continue;
      }

      const candidateLevel = Number(candidate.getAttribute('aria-level') ?? '1');
      if (candidateLevel < level) {
        event.preventDefault();
        focusSidebarCompositeItem(items, index);
        return true;
      }
    }

    return false;
  }

  return false;
}

type CompositeRole = typeof SIDEBAR_LISTBOX_ITEM_ROLE | typeof SIDEBAR_TREE_ITEM_ROLE;

/**
 * Handles vertical arrow / Home / End navigation inside a sidebar composite.
 *
 * @param event - Keydown from the composite container or an item.
 * @param root - Listbox or tree element.
 * @param role - Item role under `root`.
 * @returns True when focus moved.
 */
export function handleSidebarCompositeVerticalKey(
  event: KeyboardEvent | ReactKeyboardEvent,
  root: HTMLElement,
  role: CompositeRole
): boolean {
  const key = event.key;
  // Listbox and tree both navigate vertically with Up/Down/Home/End.
  if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'Home' && key !== 'End') {
    return false;
  }

  const items = querySidebarCompositeItems(root, role);
  if (items.length === 0) {
    return false;
  }

  const currentIndex = resolveSidebarCompositeFocusIndex(items, document.activeElement);
  if (currentIndex < 0) {
    return false;
  }

  // Map Home/End/Up/Down through the shared tablist helper (Left/Right also map there,
  // but listbox never reaches this with those keys).
  const nextIndex = resolveTabListKeyAction(key, currentIndex, items.length);
  if (nextIndex == null || nextIndex === currentIndex) {
    return false;
  }

  event.preventDefault();
  focusSidebarCompositeItem(items, nextIndex);
  return true;
}

/**
 * Container keydown handler for {@link SidebarListbox} / {@link SidebarTree}.
 *
 * Moves focus among items with arrows, opens row actions with Shift+F10 /
 * ContextMenu, and leaves Enter/Space activation to the focused item.
 *
 * @param event - React keydown from the composite root.
 * @param role - Item role managed by this composite.
 */
export function handleSidebarCompositeContainerKeyDown(
  event: ReactKeyboardEvent<HTMLElement>,
  role: CompositeRole
): void {
  if (event.defaultPrevented) {
    return;
  }

  const root = event.currentTarget;
  const items = querySidebarCompositeItems(root, role);
  const focusIndex = resolveSidebarCompositeFocusIndex(items, document.activeElement);
  const focusedItem = focusIndex >= 0 ? items[focusIndex] : null;

  if (focusedItem != null && isSidebarRowActionsMenuKey(event)) {
    event.preventDefault();
    openSidebarRowActionsMenu(focusedItem);
    return;
  }

  if (role === SIDEBAR_TREE_ITEM_ROLE && focusedItem != null) {
    if (handleSidebarTreeHorizontalKey(event, focusedItem, items, focusIndex)) {
      return;
    }
  }

  handleSidebarCompositeVerticalKey(event, root, role);
}

/**
 * Keeps roving tabindex aligned when focus moves inside the composite via pointer
 * or programmatic focus.
 *
 * @param event - Focusin from the composite root.
 * @param role - Item role managed by this composite.
 */
export function handleSidebarCompositeFocusIn(
  event: FocusEvent<HTMLElement>,
  role: CompositeRole
): void {
  const root = event.currentTarget;
  const items = querySidebarCompositeItems(root, role);
  if (items.length === 0) {
    return;
  }

  const focusIndex = resolveSidebarCompositeFocusIndex(items, event.target as Element);
  if (focusIndex < 0) {
    return;
  }

  setSidebarCompositeRovingTabIndex(items, focusIndex);
}
