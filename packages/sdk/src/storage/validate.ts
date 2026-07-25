/**
 * Returns true when a value is a plain object record (not null, not an array).
 *
 * @param value - Candidate value from plugin storage.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Narrows an unknown storage value to a string-keyed record, or null when invalid.
 *
 * @param value - Raw value from plugin storage.
 */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

/**
 * Returns a string when the value is a string; otherwise the fallback.
 *
 * @param value - Candidate field value.
 * @param fallback - Value used when the candidate is not a string.
 */
export function str<F>(value: unknown, fallback: F): string | F {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Returns a finite number when the value is a number; otherwise the fallback.
 *
 * @param value - Candidate field value.
 * @param fallback - Value used when the candidate is not a finite number.
 */
export function num<F>(value: unknown, fallback: F): number | F {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Returns a boolean when the value is a boolean; otherwise the fallback.
 *
 * @param value - Candidate field value.
 * @param fallback - Value used when the candidate is not a boolean.
 */
export function bool<F>(value: unknown, fallback: F): boolean | F {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Returns the candidate when it is one of the allowed string literals; otherwise the fallback.
 *
 * @param value - Candidate field value.
 * @param allowed - Permitted string literals.
 * @param fallback - Value used when the candidate is not in {@link allowed}.
 */
export function oneOf<T extends string, F>(
  value: unknown,
  allowed: readonly T[],
  fallback: F
): T | F {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Filters an array to finite numbers; returns an empty array when the input is not an array.
 *
 * @param value - Candidate array from plugin storage.
 */
export function numArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry): entry is number => typeof entry === 'number' && Number.isFinite(entry)
  );
}

/**
 * Filters an array to non-empty strings; returns an empty array when the input is not an array.
 *
 * @param value - Candidate array from plugin storage.
 */
export function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
}

/**
 * Filters an array through a type guard; returns an empty array when the input is not an array.
 *
 * @param value - Candidate array from plugin storage.
 * @param guard - Predicate that narrows each element.
 */
export function arrayOf<T>(value: unknown, guard: (entry: unknown) => entry is T): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(guard);
}

/**
 * Builds a string-keyed record from entries that pass a type guard.
 *
 * Non-record inputs (including arrays) return an empty object so callers can treat
 * malformed storage as "no data" without throwing.
 *
 * @param value - Raw value from plugin storage.
 * @param guard - Predicate that narrows each property value.
 */
export function recordOf<T>(
  value: unknown,
  guard: (entry: unknown) => entry is T
): Record<string, T> {
  const record = asRecord(value);
  if (!record) {
    return {};
  }
  const result: Record<string, T> = {};
  for (const [key, entry] of Object.entries(record)) {
    if (guard(entry)) {
      result[key] = entry;
    }
  }
  return result;
}
