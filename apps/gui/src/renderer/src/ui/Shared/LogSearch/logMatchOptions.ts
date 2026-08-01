/**
 * Match-mode toggles for log filter inputs.
 */
export interface LogMatchOptions {
  /**
   * When true, matching is case-sensitive.
   */
  matchCase: boolean;

  /**
   * When true, the query must match a whole word (`\b` boundaries).
   */
  matchWholeWord: boolean;

  /**
   * When true, the query is treated as a JavaScript regular expression.
   */
  useRegex: boolean;
}

/**
 * Default filter options: case-insensitive substring match.
 */
export const DEFAULT_LOG_MATCH_OPTIONS: LogMatchOptions = {
  matchCase: false,
  matchWholeWord: false,
  useRegex: false
};

/**
 * Escapes a literal string so it can be embedded in a RegExp source.
 *
 * @param value - Raw substring to escape.
 * @returns Escaped pattern fragment.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds the RegExp used to test a haystack string, or null when the pattern
 * is empty/whitespace or an invalid regular expression.
 *
 * Whole-word mode wraps the pattern in `\b(?:…)\b` (JS word characters).
 *
 * @param query - Raw filter text.
 * @param options - Case, whole-word, and regex toggles.
 * @returns Compiled matcher, or null when empty/invalid.
 */
export function buildLogFilterRegExp(query: string, options: LogMatchOptions): RegExp | null {
  const trimmed = query.trim();
  if (trimmed === '') {
    return null;
  }

  let source: string;
  if (options.useRegex) {
    source = trimmed;
  } else {
    source = escapeRegExp(trimmed);
  }

  if (options.matchWholeWord) {
    source = `\\b(?:${source})\\b`;
  }

  const flags = options.matchCase ? '' : 'i';
  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

/**
 * Returns whether a non-empty regex filter query compiles successfully.
 *
 * Empty queries are treated as valid (they match everything). Literal
 * (non-regex) queries are always valid.
 *
 * @param query - Raw filter text.
 * @param options - Match toggles; only `useRegex` and whole-word wrapping matter.
 * @returns False when regex mode is on and the pattern is invalid.
 */
export function isLogFilterQueryValid(query: string, options: LogMatchOptions): boolean {
  if (query.trim() === '') {
    return true;
  }
  if (!options.useRegex) {
    return true;
  }
  return buildLogFilterRegExp(query, options) != null;
}

/**
 * Returns whether a haystack string matches the filter query.
 *
 * @param haystack - Text to search (typically the visible log line).
 * @param query - Raw search text; empty or whitespace-only matches everything.
 * @param options - Case, whole-word, and regex toggles (defaults: all off).
 * @returns True when the haystack should remain visible for the query.
 */
export function matchesLogText(
  haystack: string,
  query: string,
  options: LogMatchOptions = DEFAULT_LOG_MATCH_OPTIONS
): boolean {
  const trimmed = query.trim();
  if (trimmed === '') {
    return true;
  }

  const pattern = buildLogFilterRegExp(query, options);
  if (pattern == null) {
    // Invalid regex (or empty after trim handled above) matches nothing.
    return false;
  }

  if (!options.useRegex && !options.matchWholeWord) {
    // Fast path for plain substring matching.
    if (options.matchCase) {
      return haystack.includes(trimmed);
    }
    return haystack.toLowerCase().includes(trimmed.toLowerCase());
  }

  return pattern.test(haystack);
}
