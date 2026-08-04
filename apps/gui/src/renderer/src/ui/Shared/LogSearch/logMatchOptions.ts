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
 * Parsed filter query: optional leading `-` exclude, with `\-` escape for a
 * literal leading hyphen.
 */
export interface ParsedLogFilterQuery {
  /**
   * When true, rows matching `pattern` are hidden instead of shown.
   */
  negated: boolean;

  /**
   * Pattern text after stripping leading `-` / `\-` and trimming. Empty means
   * no filter (show all rows).
   */
  pattern: string;
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
 * Parses a log filter query for optional leading `-` exclusion.
 *
 * A leading `-` with a non-empty remainder excludes matching rows. Prefix the
 * query with `\-` to search for a literal leading hyphen instead. A bare `-`
 * (or empty / whitespace-only input) is treated as no filter.
 *
 * @param query - Raw filter text from the search input.
 * @returns Whether the match should be inverted, and the pattern to test.
 */
export function parseLogFilterQuery(query: string): ParsedLogFilterQuery {
  const trimmed = query.trim();
  if (trimmed === '' || trimmed === '-') {
    return { negated: false, pattern: '' };
  }

  if (trimmed.startsWith('\\-')) {
    return { negated: false, pattern: trimmed.slice(1) };
  }

  if (trimmed.startsWith('-')) {
    return { negated: true, pattern: trimmed.slice(1).trim() };
  }

  return { negated: false, pattern: trimmed };
}

/**
 * Builds the RegExp used to test a haystack string, or null when the pattern
 * is empty/whitespace or an invalid regular expression.
 *
 * Leading `-` / `\-` are stripped via {@link parseLogFilterQuery} before
 * compiling; callers that need exclude semantics should use
 * {@link matchesLogText} rather than inverting this RegExp themselves.
 *
 * Whole-word mode wraps the pattern in `\b(?:…)\b` (JS word characters).
 *
 * @param query - Raw filter text.
 * @param options - Case, whole-word, and regex toggles.
 * @returns Compiled matcher, or null when empty/invalid.
 */
export function buildLogFilterRegExp(query: string, options: LogMatchOptions): RegExp | null {
  const { pattern } = parseLogFilterQuery(query);
  if (pattern === '') {
    return null;
  }

  let source: string;
  if (options.useRegex) {
    source = pattern;
  } else {
    source = escapeRegExp(pattern);
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
 * Empty queries (including a bare `-`) are treated as valid (they match
 * everything). Literal (non-regex) queries are always valid. Leading `-` /
 * `\-` are stripped before validation.
 *
 * @param query - Raw filter text.
 * @param options - Match toggles; only `useRegex` and whole-word wrapping matter.
 * @returns False when regex mode is on and the pattern is invalid.
 */
export function isLogFilterQueryValid(query: string, options: LogMatchOptions): boolean {
  const { pattern } = parseLogFilterQuery(query);
  if (pattern === '') {
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
 * A leading `-` excludes rows that match the remainder (e.g. `-error` hides
 * lines containing `error`). Use `\-term` to include a literal leading hyphen.
 * Aa / whole-word / regex toggles apply to the pattern after stripping `-` /
 * `\-`. Invalid regex patterns match nothing and are never inverted.
 *
 * @param haystack - Text to search (typically the visible log line).
 * @param query - Raw search text; empty, whitespace-only, or bare `-` matches everything.
 * @param options - Case, whole-word, and regex toggles (defaults: all off).
 * @returns True when the haystack should remain visible for the query.
 */
export function matchesLogText(
  haystack: string,
  query: string,
  options: LogMatchOptions = DEFAULT_LOG_MATCH_OPTIONS
): boolean {
  const { negated, pattern } = parseLogFilterQuery(query);
  if (pattern === '') {
    return true;
  }

  const compiled = buildLogFilterRegExp(query, options);
  if (compiled == null) {
    // Invalid regex matches nothing; do not invert so exclude stays empty too.
    return false;
  }

  let matched: boolean;
  if (!options.useRegex && !options.matchWholeWord) {
    // Fast path for plain substring matching.
    if (options.matchCase) {
      matched = haystack.includes(pattern);
    } else {
      matched = haystack.toLowerCase().includes(pattern.toLowerCase());
    }
  } else {
    matched = compiled.test(haystack);
  }

  return negated ? !matched : matched;
}
