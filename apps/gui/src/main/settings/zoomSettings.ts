import Store from 'electron-store';

/** Minimum zoom factor allowed for the main renderer. */
export const MIN_ZOOM_FACTOR = 0.3;

/** Maximum zoom factor allowed for the main renderer. */
export const MAX_ZOOM_FACTOR = 5;

/** Default zoom factor for the main renderer (100%). */
export const DEFAULT_ZOOM_FACTOR = 1;

const STORE_KEY = 'zoomFactor';

let store: Store<{ zoomFactor: number }> | null = null;

/**
 * Returns the lazy electron-store instance for main-window zoom preferences.
 */
function getStore(): Store<{ zoomFactor: number }> {
  if (!store) {
    store = new Store<{ zoomFactor: number }>({
      name: 'settings',
      defaults: {
        zoomFactor: DEFAULT_ZOOM_FACTOR
      }
    });
  }
  return store;
}

/**
 * Rounds a zoom factor to one decimal place for stable menu stepping.
 *
 * @param factor - Raw zoom factor value.
 */
export function roundZoomFactor(factor: number): number {
  return Math.round(factor * 10) / 10;
}

/**
 * Clamps and rounds a zoom factor to supported persisted bounds.
 *
 * @param value - Raw zoom factor from storage or user input.
 * @returns Normalized zoom factor.
 */
function normalizeZoomFactor(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_ZOOM_FACTOR;
  }
  const rounded = roundZoomFactor(parsed);
  return Math.min(MAX_ZOOM_FACTOR, Math.max(MIN_ZOOM_FACTOR, rounded));
}

/**
 * Reads the persisted main-window zoom factor.
 *
 * @returns Normalized zoom factor, defaulting to 100% when unset or invalid.
 */
export function getPersistedZoomFactor(): number {
  const stored = getStore().get(STORE_KEY, DEFAULT_ZOOM_FACTOR);
  return normalizeZoomFactor(stored);
}

/**
 * Persists the main-window zoom factor.
 *
 * @param factor - Zoom factor to remember.
 */
export function setPersistedZoomFactor(factor: number): void {
  getStore().set(STORE_KEY, normalizeZoomFactor(factor));
}
