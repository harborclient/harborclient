/**
 * Options for comparing a variable key against a clear entry.
 */
export interface VariableClearMatchOptions {
  /**
   * When true, trim and compare keys case-insensitively (persisted variable rows).
   * When false, compare as stored (sandbox get/clear).
   */
  caseInsensitive?: boolean;
}

/**
 * Returns whether a clear argument is a namespace pattern (`namespace.*`).
 *
 * @param clearKey - Exact key or trailing `.*` pattern passed to `hc.*.clear`.
 * @returns True when the trimmed key ends with `.*` and has a non-empty prefix.
 */
export function isNamespaceVariableClearPattern(clearKey: string): boolean {
  const trimmed = clearKey.trim();
  return trimmed.endsWith('.*') && trimmed.length > 2;
}

/**
 * Returns whether a variable key is covered by a clear entry.
 *
 * Exact clears match one key. Namespace patterns ending in `.*` match every key
 * that starts with the prefix before `*` (for example `workflow_a.*` matches
 * `workflow_a.foo` and `workflow_a.foo.bar`, but not `workflow_a`).
 *
 * @param variableKey - Variable key being read, set, or persisted.
 * @param clearKey - Exact key or `namespace.*` pattern from a clear call.
 * @param options - Optional case-insensitivity for persisted rows.
 * @returns True when the variable key should be treated as cleared.
 */
export function variableClearMatches(
  variableKey: string,
  clearKey: string,
  options?: VariableClearMatchOptions
): boolean {
  const caseInsensitive = options?.caseInsensitive === true;
  const key = caseInsensitive ? variableKey.trim().toLowerCase() : variableKey;
  const clear = caseInsensitive ? clearKey.trim().toLowerCase() : clearKey;

  if (!key || !clear) {
    return false;
  }

  if (isNamespaceVariableClearPattern(clear)) {
    // `workflow_a.*` → prefix `workflow_a.` (drop the trailing `*`).
    const prefix = clear.slice(0, -1);
    return key.startsWith(prefix);
  }

  return key === clear;
}

/**
 * Returns whether any clear entry matches the variable key.
 *
 * @param variableKey - Variable key being read or filtered.
 * @param clears - Exact keys and/or `namespace.*` patterns from clear calls.
 * @param options - Optional case-insensitivity for persisted rows.
 * @returns True when at least one clear entry matches.
 */
export function variableKeyIsCleared(
  variableKey: string,
  clears: Iterable<string>,
  options?: VariableClearMatchOptions
): boolean {
  for (const clearKey of clears) {
    if (variableClearMatches(variableKey, clearKey, options)) {
      return true;
    }
  }
  return false;
}
