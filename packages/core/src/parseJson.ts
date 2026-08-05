/**
 * Parses a JSON string, returning a fallback value on failure or when empty.
 *
 * The result is untyped (`unknown`). Callers must validate shape before use
 * (Zod schema, type guard, or a normalizer that accepts `unknown`).
 *
 * @param value - JSON string to parse.
 * @param fallback - Value returned when parsing fails or value is empty.
 * @returns Parsed JSON value, or `fallback` when empty / invalid.
 */
export function parseJson(value: string | undefined | null, fallback: unknown = null): unknown {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Returns whether value is a non-null object that is not an array.
 *
 * Useful as a first-pass guard after {@link parseJson} before field-level checks.
 *
 * @param value - Value to inspect.
 * @returns True when value is a plain object record.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
