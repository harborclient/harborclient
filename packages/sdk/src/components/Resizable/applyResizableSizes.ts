/** Window event name used to re-read localStorage sizes after an external write. */
export const RESIZABLE_SYNC_EVENT = 'hc:resizable-sync';

/**
 * Persists a size to localStorage.
 *
 * @param storageKey - localStorage key for the panel size.
 * @param size - Size in pixels to store.
 */
function persistSize(storageKey: string, size: number): void {
  try {
    localStorage.setItem(storageKey, String(size));
  } catch {
    // Ignore quota or privacy-mode failures.
  }
}

/**
 * Writes resizable panel sizes to localStorage and notifies mounted hooks to re-read.
 *
 * Used when restoring a workspace layout snapshot that includes panel widths/heights.
 *
 * @param entries - Map of storageKey → size in pixels.
 */
export function applyResizableSizes(entries: Record<string, number>): void {
  for (const [storageKey, size] of Object.entries(entries)) {
    if (!Number.isFinite(size)) {
      continue;
    }
    persistSize(storageKey, Math.round(size));
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RESIZABLE_SYNC_EVENT));
  }
}
