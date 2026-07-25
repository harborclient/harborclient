/**
 * A filter invocation inside a `{{ variable | filter }}` expression.
 */
export interface FilterCall {
  /**
   * Filter name (e.g. `upper`, `urlencode`).
   */
  name: string;

  /**
   * Positional arguments for future filter support; always empty for now.
   */
  args: string[];
}

/**
 * Registry of Twig-style variable filters.
 *
 * Add or edit entries here to extend filter support. Each filter receives the
 * current piped string value and an argument list (unused until arg support ships).
 */
export const FILTERS: Record<string, (value: string, args: string[]) => string> = {
  upper: (value) => value.toUpperCase(),
  lower: (value) => value.toLowerCase(),
  urlencode: (value) => encodeURIComponent(value),
  trim: (value) => value.trim(),
  length: (value) => String(value.length),
  striptags: (value) => value.replace(/<[^>]*>/g, ''),
  capitalize: (value) => {
    if (value.length === 0) {
      return value;
    }
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  },
  round: (value) => {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return value;
    }
    return String(Math.round(numeric));
  }
};

/**
 * Sorted list of registered filter names for autocomplete and documentation.
 */
export const FILTER_NAMES = Object.keys(FILTERS).sort();

/**
 * Pipes a resolved variable value through a chain of filters left-to-right.
 *
 * @param value - Resolved variable value before filtering.
 * @param filters - Ordered filter calls from the expression.
 * @returns Filtered value, or null when an unknown filter name is encountered.
 */
export function applyFilters(value: string, filters: FilterCall[]): string | null {
  let current = value;

  for (const filter of filters) {
    const handler = FILTERS[filter.name];
    if (!handler) {
      return null;
    }
    current = handler(current, filter.args);
  }

  return current;
}
