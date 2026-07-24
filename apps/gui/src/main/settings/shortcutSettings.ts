import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { parseJson } from '#/shared/parseJson';
import {
  normalizeShortcutOverrides,
  resolveShortcuts,
  validateShortcutOverrides,
  type ShortcutBinding,
  type ShortcutOverrides,
  type ShortcutValidationResult
} from '#/shared/shortcuts';

const STORE_KEY = 'shortcuts';

/**
 * Reads persisted shortcut overrides from LocalDatabase.
 *
 * @returns Normalized shortcut overrides.
 */
export function getShortcutOverrides(): ShortcutOverrides {
  const stored = parseJson<unknown>(getLocalDatabase().getSetting(STORE_KEY), {});
  return normalizeShortcutOverrides(stored);
}

/**
 * Returns resolved shortcut bindings with defaults applied.
 *
 * @returns Shortcut bindings for IPC and menu construction.
 */
export function getResolvedShortcuts(): ShortcutBinding[] {
  return resolveShortcuts(getShortcutOverrides());
}

/**
 * Validates shortcut overrides before persistence.
 *
 * @param overrides - Candidate overrides keyed by shortcut id.
 * @returns Validation result with per-shortcut errors.
 */
export function validateShortcuts(overrides: ShortcutOverrides): ShortcutValidationResult {
  return validateShortcutOverrides(normalizeShortcutOverrides(overrides));
}

/**
 * Persists shortcut overrides after validation.
 *
 * @param overrides - Overrides keyed by shortcut id.
 * @returns Resolved bindings after save.
 * @throws Error when validation fails.
 */
export function setShortcutOverrides(overrides: ShortcutOverrides): ShortcutBinding[] {
  const normalized = normalizeShortcutOverrides(overrides);
  const validation = validateShortcutOverrides(normalized);
  if (!validation.valid) {
    throw new Error('Invalid shortcut configuration.');
  }

  getLocalDatabase().setSetting(STORE_KEY, JSON.stringify(normalized));
  return resolveShortcuts(normalized);
}

/**
 * Clears persisted shortcut overrides and returns default bindings.
 *
 * @returns Default shortcut bindings.
 */
export function resetShortcuts(): ShortcutBinding[] {
  getLocalDatabase().setSetting(STORE_KEY, JSON.stringify({}));
  return resolveShortcuts({});
}
