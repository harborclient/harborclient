import Store from 'electron-store';
import type { DatabaseProvider, FirestoreSettings } from '#/shared/types';

const DEFAULT_FIRESTORE_SETTINGS: FirestoreSettings = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
  email: '',
  password: ''
};

type SettingsStore = {
  provider: DatabaseProvider;
  firestore: FirestoreSettings;
};

let store: Store<SettingsStore> | null = null;

/**
 * Returns the lazy electron-store instance for database provider settings.
 */
function getStore(): Store<SettingsStore> {
  if (!store) {
    store = new Store<SettingsStore>({
      name: 'settings',
      defaults: {
        provider: 'sqlite',
        firestore: DEFAULT_FIRESTORE_SETTINGS
      }
    });
  }
  return store;
}

/**
 * Normalizes Firestore settings with trimmed fields.
 *
 * @param input - Raw settings from storage or user input.
 * @returns Normalized settings.
 */
function normalizeFirestoreSettings(input: Partial<FirestoreSettings>): FirestoreSettings {
  return {
    apiKey: input.apiKey?.trim() ?? '',
    authDomain: input.authDomain?.trim() ?? '',
    projectId: input.projectId?.trim() ?? '',
    appId: input.appId?.trim() ?? '',
    email: input.email?.trim() ?? '',
    password: input.password ?? ''
  };
}

/**
 * Reads the persisted database provider.
 *
 * @returns Active database provider, defaulting to sqlite.
 */
export function getDatabaseProvider(): DatabaseProvider {
  const provider = getStore().get('provider', 'sqlite');
  return provider === 'firestore' ? 'firestore' : 'sqlite';
}

/**
 * Persists the database provider selection.
 *
 * @param provider - Provider to use on next launch.
 */
export function setDatabaseProvider(provider: DatabaseProvider): void {
  getStore().set('provider', provider === 'firestore' ? 'firestore' : 'sqlite');
}

/**
 * Reads persisted Firestore connection settings.
 *
 * @returns Current Firestore settings.
 */
export function getFirestoreSettings(): FirestoreSettings {
  const stored = getStore().get('firestore', DEFAULT_FIRESTORE_SETTINGS);
  return normalizeFirestoreSettings(stored);
}

/**
 * Persists Firestore connection settings.
 *
 * @param input - Settings to store.
 */
export function setFirestoreSettings(input: FirestoreSettings): void {
  getStore().set('firestore', normalizeFirestoreSettings(input));
}
