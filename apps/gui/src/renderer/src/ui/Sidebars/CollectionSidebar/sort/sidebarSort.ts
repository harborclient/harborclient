import type { SortOption } from '@harborclient/sdk/components';
import type { SidebarSortMode } from '@harborclient/core/types';

/**
 * Field accessors used to compare sidebar items for a given sort mode.
 */
export interface SortAccessors<T> {
  /**
   * Returns the display name used for A-Z sorting.
   */
  name: (item: T) => string;

  /**
   * Returns a comparable creation (or deletion) timestamp in milliseconds.
   */
  createdAt: (item: T) => number;

  /**
   * Optional color accessor; used only for the `color` sort mode.
   */
  color?: (item: T) => string | null | undefined;
}

/**
 * Normalizes a CSS color string for case-insensitive comparison.
 *
 * @param value - Raw color string from storage or user input.
 * @returns Trimmed lowercase color string, or empty when missing.
 */
function normalizeCssColor(value: string | null | undefined): string {
  if (value == null) {
    return '';
  }
  return value.trim().toLowerCase();
}

/**
 * Compares two names with case-insensitive locale ordering.
 *
 * @param a - First name.
 * @param b - Second name.
 * @returns Negative when `a` sorts before `b`.
 */
function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

/**
 * Builds the sort option list for a sidebar section header menu.
 *
 * @param hasColor - When true, includes the Color option (colors are visible and
 *   the section's items carry a color field).
 * @param dateLabel - Prefix for date options; defaults to "Date created".
 * @returns Ordered sort options for the listbox.
 */
export function sidebarSortOptions(
  hasColor: boolean,
  dateLabel = 'Date created'
): SortOption[] {
  const options: SortOption[] = [
    { id: 'default', label: 'Default' },
    { id: 'name-asc', label: 'A-Z ascending' },
    { id: 'name-desc', label: 'A-Z descending' },
    { id: 'created-asc', label: `${dateLabel} ascending` },
    { id: 'created-desc', label: `${dateLabel} descending` }
  ];
  if (hasColor) {
    options.push({ id: 'color', label: 'Color' });
  }
  return options;
}

/**
 * Returns a shallow-copied list sorted by the given mode. `default` leaves the
 * input order unchanged so manual/`sort_order`/newest-first ordering is preserved.
 *
 * @param items - Items to sort.
 * @param mode - Active sort mode.
 * @param accessors - Name/createdAt/color accessors for the item type.
 * @returns Sorted array (or a copy of the input when mode is `default`).
 */
export function sortSidebarItems<T>(
  items: readonly T[],
  mode: SidebarSortMode,
  accessors: SortAccessors<T>
): T[] {
  if (mode === 'default') {
    return [...items];
  }

  const sorted = [...items];
  sorted.sort((left, right) => {
    switch (mode) {
      case 'name-asc':
        return compareNames(accessors.name(left), accessors.name(right));
      case 'name-desc':
        return compareNames(accessors.name(right), accessors.name(left));
      case 'created-asc':
        return accessors.createdAt(left) - accessors.createdAt(right);
      case 'created-desc':
        return accessors.createdAt(right) - accessors.createdAt(left);
      case 'color': {
        const leftColor = normalizeCssColor(accessors.color?.(left));
        const rightColor = normalizeCssColor(accessors.color?.(right));
        if (leftColor === '' && rightColor === '') {
          return compareNames(accessors.name(left), accessors.name(right));
        }
        if (leftColor === '') {
          return 1;
        }
        if (rightColor === '') {
          return -1;
        }
        const colorCmp = leftColor.localeCompare(rightColor);
        if (colorCmp !== 0) {
          return colorCmp;
        }
        return compareNames(accessors.name(left), accessors.name(right));
      }
      default:
        return 0;
    }
  });
  return sorted;
}

/**
 * Parses an ISO date or numeric timestamp into epoch milliseconds.
 *
 * @param value - ISO string, epoch ms number, or nullish.
 * @returns Epoch milliseconds, or 0 when unparseable.
 */
export function toSortTimestamp(value: string | number | null | undefined): number {
  if (value == null) {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
