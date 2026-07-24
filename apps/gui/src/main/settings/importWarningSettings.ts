import Store from 'electron-store';

const STORE_KEY = 'suppressPostmanImportWarning';

let store: Store<{ suppressPostmanImportWarning: boolean }> | null = null;

/**
 * Returns the lazy electron-store instance for import warning preferences.
 */
function getStore(): Store<{ suppressPostmanImportWarning: boolean }> {
  if (!store) {
    store = new Store<{ suppressPostmanImportWarning: boolean }>({
      name: 'settings',
      defaults: {
        suppressPostmanImportWarning: false
      }
    });
  }
  return store;
}

/**
 * Returns whether the Postman import compatibility warning should be skipped.
 *
 * @returns True when the user chose not to show the warning again.
 */
export function getSuppressPostmanImportWarning(): boolean {
  return getStore().get(STORE_KEY, false);
}

/**
 * Persists whether the Postman import compatibility warning should be skipped.
 *
 * @param value - True to suppress the warning on future Postman imports.
 */
export function setSuppressPostmanImportWarning(value: boolean): void {
  getStore().set(STORE_KEY, value);
}
