/**
 * Sidebar entity that may carry an optional CSS marker for the marker filter.
 */
export interface SidebarMarkedItem {
  /**
   * Optional CSS marker assigned to the sidebar row.
   */
  marker?: string | null;
}

/**
 * Normalizes a CSS marker string for case-insensitive comparison.
 *
 * @param value - Raw marker string from storage or user input.
 * @returns Trimmed lowercase marker string.
 */
function normalizeCssColor(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Returns whether two CSS marker strings represent the same marker.
 *
 * @param a - First marker string.
 * @param b - Second marker string.
 */
function colorsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) {
    return false;
  }
  return normalizeCssColor(a) === normalizeCssColor(b);
}

/**
 * Collects unique CSS markers assigned to flat sidebar items (environments, tab
 * groups), sorted for stable UI order. Deduplicates case-insensitively while
 * keeping the first-seen original form.
 *
 * @param items - Sidebar entities that may carry a `marker` field.
 * @returns Deduplicated marker strings sorted locale-ascending.
 */
export function collectSidebarItemMarkers(items: readonly SidebarMarkedItem[]): string[] {
  const seen = new Map<string, string>();

  for (const item of items) {
    const marker = item.marker;
    if (marker == null || marker.trim() === '') {
      continue;
    }
    const key = normalizeCssColor(marker);
    if (!seen.has(key)) {
      seen.set(key, marker.trim());
    }
  }

  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Returns items matching the active marker filter, or all items when the filter
 * is inactive (`null`).
 *
 * @param items - Sidebar entities to filter.
 * @param colorFilter - Selected CSS marker, or null for all markers.
 * @returns Items whose marker matches `colorFilter`, or the original array when inactive.
 */
export function filterItemsByMarker<T extends SidebarMarkedItem>(
  items: readonly T[],
  colorFilter: string | null
): T[] {
  if (colorFilter == null) {
    return [...items];
  }
  return items.filter((item) => colorsMatch(item.marker, colorFilter));
}
