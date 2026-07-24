import Store from 'electron-store';
import {
  DEFAULT_COLLECTION_RUNNER_CONFIG,
  normalizeCollectionRunnerConfig,
  type CollectionRunnerConfig
} from '#/shared/collectionRunner';

const STORE_KEY = 'collectionRunnerConfig';

let store: Store<{ collectionRunnerConfig: CollectionRunnerConfig }> | null = null;

/**
 * Returns the lazy electron-store instance for collection runner preferences.
 */
function getStore(): Store<{ collectionRunnerConfig: CollectionRunnerConfig }> {
  if (!store) {
    store = new Store<{ collectionRunnerConfig: CollectionRunnerConfig }>({
      name: 'settings',
      defaults: {
        collectionRunnerConfig: DEFAULT_COLLECTION_RUNNER_CONFIG
      }
    });
  }
  return store;
}

/**
 * Returns persisted collection runner configuration.
 */
export function getCollectionRunnerConfig(): CollectionRunnerConfig {
  const stored = getStore().get(STORE_KEY, DEFAULT_COLLECTION_RUNNER_CONFIG);
  return normalizeCollectionRunnerConfig(stored ?? DEFAULT_COLLECTION_RUNNER_CONFIG);
}

/**
 * Persists collection runner configuration.
 *
 * @param config - Runner settings snapshot to store.
 */
export function setCollectionRunnerConfig(config: CollectionRunnerConfig): void {
  getStore().set(STORE_KEY, normalizeCollectionRunnerConfig(config));
}
