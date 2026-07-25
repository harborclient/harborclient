import type { MenuItem } from './RowActionsMenu/index.js';

/**
 * Tailwind classes for a single menu item button, shared by the main
 * `RowActionsMenu` panel and its flyout `Submenu` panels.
 */
export function menuItemClass(variant: MenuItem['variant'], disabled?: boolean): string {
  const base =
    'flex w-full items-center gap-2 border-none bg-transparent px-3.5 py-1.5 text-left app-no-drag';

  if (disabled) {
    return `${base} cursor-not-allowed text-muted opacity-60`;
  }

  const interactive = `${base} cursor-pointer`;

  return variant === 'danger'
    ? `${interactive} text-text hover:bg-danger/15 hover:text-danger`
    : `${interactive} text-text hover:bg-selection`;
}

/**
 * Returns whether a menu item can receive focus or activate an action.
 */
export function isMenuItemEnabled(item: MenuItem): boolean {
  return !item.disabled;
}

/**
 * Finds the next enabled flat item index in the requested direction.
 */
export function findAdjacentEnabledIndex(
  items: MenuItem[],
  fromIndex: number,
  direction: -1 | 1
): number | null {
  let index = fromIndex + direction;

  while (index >= 0 && index < items.length) {
    if (isMenuItemEnabled(items[index])) {
      return index;
    }
    index += direction;
  }

  return null;
}

/**
 * Returns the first or last enabled flat item index.
 */
export function findEdgeEnabledIndex(items: MenuItem[], fromEnd: boolean): number | null {
  if (fromEnd) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (isMenuItemEnabled(items[index])) {
        return index;
      }
    }
    return null;
  }

  return items.findIndex((item) => isMenuItemEnabled(item));
}

/**
 * Builds an optional reorder group for move-up/move-down row actions.
 *
 * Returns one menu group when the row can move in at least one direction,
 * otherwise an empty array so callers can spread it into `groups`.
 *
 * @param index - Zero-based position of the row in its list.
 * @param length - Total number of rows in the list.
 * @param onMove - Called with the direction to move the row.
 */
export function buildReorderMenuGroup(
  index: number,
  length: number,
  onMove: (direction: 'up' | 'down') => void
): MenuItem[][] {
  if (index <= 0 && index >= length - 1) {
    return [];
  }

  const items: MenuItem[] = [];

  if (index > 0) {
    items.push({
      label: 'Move up',
      onSelect: () => void onMove('up')
    });
  }

  if (index < length - 1) {
    items.push({
      label: 'Move down',
      onSelect: () => void onMove('down')
    });
  }

  return items.length > 0 ? [items] : [];
}
