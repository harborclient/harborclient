import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faArrowDownShortWide, faArrowUpShortWide } from '@fortawesome/free-solid-svg-icons';
import { compareHttpMethods } from '@harborclient/core/httpMethod';
import type { SidebarSortMode } from '@harborclient/core/types';
import type { SortOption } from '@harborclient/sdk/components';

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
   * Optional marker accessor; used only for the `marker` sort mode.
   */
  marker?: (item: T) => string | null | undefined;

  /**
   * Optional HTTP method accessor; used only for `method-asc` / `method-desc`.
   * Items without a method (folders, documents, collections) sort after requests.
   */
  method?: (item: T) => string | null | undefined;
}

/**
 * Normalizes a CSS marker string for case-insensitive comparison.
 *
 * @param value - Raw marker string from storage or user input.
 * @returns Trimmed lowercase marker string, or empty when missing.
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
 * @param hasMarker - When true, includes the Marker option (markers are visible and
 *   the section's items carry a marker field).
 * @param dateLabel - Prefix for date options; defaults to "Date created".
 * @param hasMethod - When true, includes Method ascending/descending before date options
 *   (Collections section, where rows are HTTP requests).
 * @returns Ordered sort options for the listbox.
 */
export function sidebarSortOptions(
  hasMarker: boolean,
  dateLabel = 'Date created',
  hasMethod = false
): SortOption[] {
  const options: SortOption[] = [
    { id: 'default', label: 'Default' },
    { id: 'name-asc', label: 'A-Z ascending' },
    { id: 'name-desc', label: 'A-Z descending' }
  ];
  if (hasMethod) {
    options.push(
      { id: 'method-asc', label: 'Method ascending' },
      { id: 'method-desc', label: 'Method descending' }
    );
  }
  options.push(
    { id: 'created-asc', label: `${dateLabel} ascending` },
    { id: 'created-desc', label: `${dateLabel} descending` }
  );
  if (hasMarker) {
    options.push({ id: 'marker', label: 'Color marker' });
  }
  return options;
}

/**
 * Returns the Font Awesome icon for a sidebar sort mode. Ascending modes use
 * `arrow-up-short-wide`; descending and default use `arrow-down-short-wide`.
 *
 * @param mode - Active sort mode for the section.
 * @returns Icon reflecting ascending vs descending direction.
 */
export function sidebarSortIcon(mode: SidebarSortMode): IconDefinition {
  switch (mode) {
    case 'name-asc':
    case 'method-asc':
    case 'created-asc':
    case 'marker':
      return faArrowUpShortWide;
    default:
      return faArrowDownShortWide;
  }
}

/**
 * Returns a shallow-copied list sorted by the given mode. `default` leaves the
 * input order unchanged so manual/`sort_order`/newest-first ordering is preserved.
 *
 * @param items - Items to sort.
 * @param mode - Active sort mode.
 * @param accessors - Name/createdAt/marker/method accessors for the item type.
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
      case 'method-asc':
      case 'method-desc': {
        const direction = mode === 'method-asc' ? 'asc' : 'desc';
        const methodCmp = compareHttpMethods(
          accessors.method?.(left),
          accessors.method?.(right),
          direction
        );
        if (methodCmp !== 0) {
          return methodCmp;
        }
        return compareNames(accessors.name(left), accessors.name(right));
      }
      case 'created-asc':
        return accessors.createdAt(left) - accessors.createdAt(right);
      case 'created-desc':
        return accessors.createdAt(right) - accessors.createdAt(left);
      case 'marker': {
        const leftMarker = normalizeCssColor(accessors.marker?.(left));
        const rightMarker = normalizeCssColor(accessors.marker?.(right));
        if (leftMarker === '' && rightMarker === '') {
          return compareNames(accessors.name(left), accessors.name(right));
        }
        if (leftMarker === '') {
          return 1;
        }
        if (rightMarker === '') {
          return -1;
        }
        const markerCmp = leftMarker.localeCompare(rightMarker);
        if (markerCmp !== 0) {
          return markerCmp;
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
