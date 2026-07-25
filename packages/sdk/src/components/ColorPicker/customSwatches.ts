import { CUSTOM_SWATCH_SLOT_COUNT } from './colorUtils.js';

/** Default localStorage key for persisted custom color swatches. */
export const DEFAULT_CUSTOM_SWATCHES_STORAGE_KEY = 'hc.sidebarCustomSwatches';

/**
 * Loads custom swatch colors from localStorage.
 *
 * @param storageKey - localStorage key for the swatch array.
 * @returns Up to five hex color strings; empty slots are omitted.
 */
export function loadCustomSwatches(storageKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const result: string[] = [];
    for (const entry of parsed) {
      if (typeof entry !== 'string' || entry.trim() === '') {
        continue;
      }
      result.push(entry.trim());
      if (result.length >= CUSTOM_SWATCH_SLOT_COUNT) {
        break;
      }
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * Persists custom swatch colors to localStorage.
 *
 * @param storageKey - localStorage key for the swatch array.
 * @param swatches - Hex colors for each custom slot (length up to five).
 */
export function persistCustomSwatches(storageKey: string, swatches: string[]): void {
  try {
    const normalized = swatches
      .slice(0, CUSTOM_SWATCH_SLOT_COUNT)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    localStorage.setItem(storageKey, JSON.stringify(normalized));
  } catch {
    // Ignore quota or privacy-mode failures.
  }
}

/**
 * Returns the custom swatch slot values padded to the fixed slot count.
 *
 * @param swatches - Loaded custom swatches.
 */
export function padCustomSwatchSlots(swatches: string[]): string[] {
  const slots = swatches.slice(0, CUSTOM_SWATCH_SLOT_COUNT);
  while (slots.length < CUSTOM_SWATCH_SLOT_COUNT) {
    slots.push('');
  }
  return slots;
}
