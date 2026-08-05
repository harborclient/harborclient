/**
 * Heuristic safety checks for user-supplied regular expression sources.
 *
 * Caps length and rejects nested-quantifier shapes associated with
 * catastrophic backtracking before callers compile with native `RegExp`.
 * This is not a full safe-regex proof.
 */

/**
 * Maximum length of a user-controlled regex source string.
 */
export const USER_REGEX_MAX_LENGTH = 256;

/**
 * Detects nested quantifiers that commonly enable catastrophic backtracking
 * (e.g. `(a+)+`, `([a-z]*)*`).
 */
const CATASTROPHIC_QUANTIFIER =
  /(?:\((?:[^()\\]|\\.)*[+*?](?:[^()\\]|\\.)*\)|\[[^\]]*\][+*?])[+*?{]/;

/**
 * Unbounded or open-ended quantifiers used for density checks.
 */
const UNBOUNDED_QUANTIFIER = /(?<!\\)(?:\*|\+|\{\d*,\d*\})/g;

/**
 * Maximum number of unbounded quantifiers allowed in a user regex source.
 */
const MAX_UNBOUNDED_QUANTIFIERS = 10;

/**
 * Returns whether a regex source is safe to compile and use.
 *
 * The source must be non-empty (after trim), at most
 * {@link USER_REGEX_MAX_LENGTH} characters, free of nested quantifier shapes
 * associated with ReDoS, below the unbounded-quantifier density cap, and
 * syntactically valid as a `RegExp` source.
 *
 * @param source - Raw regex source (may include surrounding whitespace).
 * @returns True when the pattern may be compiled and tested.
 */
export function isSafeUserRegexSource(source: string): boolean {
  const trimmed = source.trim();
  if (trimmed === '') {
    return false;
  }
  if (trimmed.length > USER_REGEX_MAX_LENGTH) {
    return false;
  }
  if (CATASTROPHIC_QUANTIFIER.test(trimmed)) {
    return false;
  }
  const unbounded = trimmed.match(UNBOUNDED_QUANTIFIER);
  if (unbounded != null && unbounded.length > MAX_UNBOUNDED_QUANTIFIERS) {
    return false;
  }
  try {
    void new RegExp(trimmed);
    return true;
  } catch {
    return false;
  }
}

/**
 * Asserts that a regex source passes {@link isSafeUserRegexSource}.
 *
 * @param source - Raw regex source to validate.
 * @throws When the source is empty, too long, looks like a ReDoS risk, or is invalid.
 */
export function assertSafeUserRegexSource(source: string): void {
  const trimmed = source.trim();
  if (trimmed === '') {
    throw new Error('Regular expression must not be empty.');
  }
  if (trimmed.length > USER_REGEX_MAX_LENGTH) {
    throw new Error(`Regular expression must be at most ${USER_REGEX_MAX_LENGTH} characters.`);
  }
  if (CATASTROPHIC_QUANTIFIER.test(trimmed)) {
    throw new Error(
      'Regular expression looks unsafe (nested quantifiers that can cause catastrophic backtracking).'
    );
  }
  const unbounded = trimmed.match(UNBOUNDED_QUANTIFIER);
  if (unbounded != null && unbounded.length > MAX_UNBOUNDED_QUANTIFIERS) {
    throw new Error(
      `Regular expression has too many unbounded quantifiers (max ${MAX_UNBOUNDED_QUANTIFIERS}).`
    );
  }
  try {
    void new RegExp(trimmed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid regular expression: ${message}`);
  }
}
