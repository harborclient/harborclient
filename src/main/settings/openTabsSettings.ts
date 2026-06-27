import Store from 'electron-store';

const STORE_KEY = 'openTabsPayload';

let store: Store<{ openTabsPayload: string | null }> | null = null;

/**
 * Returns the lazy electron-store instance for open request tab persistence.
 */
function getStore(): Store<{ openTabsPayload: string | null }> {
  if (!store) {
    store = new Store<{ openTabsPayload: string | null }>({
      name: 'settings',
      defaults: {
        openTabsPayload: null
      }
    });
  }
  return store;
}

/**
 * Returns the persisted open-tabs JSON payload, or null when unset.
 */
export function getOpenTabsPayload(): string | null {
  const stored = getStore().get(STORE_KEY, null);
  if (typeof stored !== 'string' || stored.length === 0) {
    return null;
  }
  return stored;
}

/**
 * Persists the open-tabs JSON payload written by the renderer.
 *
 * @param payload - Serialized {@link PersistedOpenTabs} JSON from the renderer.
 */
export function setOpenTabsPayload(payload: string): void {
  getStore().set(STORE_KEY, payload);
}
