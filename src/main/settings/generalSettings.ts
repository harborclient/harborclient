import { getLocalRegistry } from '#/main/db/localRegistryInstance';
import { parseJson } from '#/shared/parseJson';
import type { GeneralSettings } from '#/shared/types';

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  requestTimeoutMs: 30000,
  maxResponseSizeMb: 50,
  verifySsl: true
};

const STORE_KEY = 'general';

/**
 * Normalizes a non-negative number, falling back to the default when invalid.
 *
 * @param value - Raw numeric value from storage or input.
 * @param fallback - Default when value is not a finite number >= 0.
 */
function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

/**
 * Normalizes a general settings object with defaults for invalid fields.
 *
 * @param input - Raw settings from storage or user input.
 * @returns Normalized settings.
 */
function normalizeSettings(input: Partial<GeneralSettings>): GeneralSettings {
  return {
    requestTimeoutMs: normalizeNonNegativeNumber(
      input.requestTimeoutMs,
      DEFAULT_GENERAL_SETTINGS.requestTimeoutMs
    ),
    maxResponseSizeMb: normalizeNonNegativeNumber(
      input.maxResponseSizeMb,
      DEFAULT_GENERAL_SETTINGS.maxResponseSizeMb
    ),
    verifySsl: input.verifySsl !== false
  };
}

/**
 * Reads persisted general request settings.
 *
 * @returns Current general settings with defaults applied.
 */
export function getGeneralSettings(): GeneralSettings {
  const stored = parseJson<Partial<GeneralSettings>>(
    getLocalRegistry().getSetting(STORE_KEY),
    DEFAULT_GENERAL_SETTINGS
  );
  return normalizeSettings(stored);
}

/**
 * Persists general request settings.
 *
 * @param input - Settings to store.
 */
export function setGeneralSettings(input: GeneralSettings): void {
  getLocalRegistry().setSetting(STORE_KEY, JSON.stringify(normalizeSettings(input)));
}
