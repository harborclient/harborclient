/**
 * Sidebar entity that may carry an optional CSS color for the color filter.
 */
export interface SidebarColoredItem {
  /**
   * Optional CSS color assigned to the sidebar row.
   */
  color?: string | null;
}

/**
 * Normalizes a CSS color string for case-insensitive comparison.
 *
 * @param value - Raw color string from storage or user input.
 * @returns Trimmed lowercase color string.
 */
function normalizeCssColor(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Returns whether two CSS color strings represent the same color.
 *
 * @param a - First color string.
 * @param b - Second color string.
 */
function colorsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) {
    return false;
  }
  return normalizeCssColor(a) === normalizeCssColor(b);
}

/**
 * Collects unique CSS colors assigned to flat sidebar items (environments, tab
 * groups), sorted for stable UI order. Deduplicates case-insensitively while
 * keeping the first-seen original form.
 *
 * @param items - Sidebar entities that may carry a `color` field.
 * @returns Deduplicated color strings sorted locale-ascending.
 */
export function collectSidebarItemColors(items: readonly SidebarColoredItem[]): string[] {
  const seen = new Map<string, string>();

  for (const item of items) {
    const color = item.color;
    if (color == null || color.trim() === '') {
      continue;
    }
    const key = normalizeCssColor(color);
    if (!seen.has(key)) {
      seen.set(key, color.trim());
    }
  }

  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/**
 * Returns items matching the active color filter, or all items when the filter
 * is inactive (`null`).
 *
 * @param items - Sidebar entities to filter.
 * @param colorFilter - Selected CSS color, or null for all colors.
 * @returns Items whose color matches `colorFilter`, or the original array when inactive.
 */
export function filterItemsByColor<T extends SidebarColoredItem>(
  items: readonly T[],
  colorFilter: string | null
): T[] {
  if (colorFilter == null) {
    return [...items];
  }
  return items.filter((item) => colorsMatch(item.color, colorFilter));
}
