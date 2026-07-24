/**
 * Parses a JSON string, returning a fallback value on failure or when empty.
 *
 * @param value - JSON string to parse.
 * @param fallback - Value returned when parsing fails or value is empty.
 */
export function parseJson<T>(value: string | undefined | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
