import type {
  DatabaseProvider,
  FirestoreSettings,
  SqliteSettings,
  ThemeSource
} from '#/shared/types';
import type { SettingsSection } from './types';

export const THEME_OPTIONS: Array<{ value: ThemeSource; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
];

export const PROVIDER_OPTIONS: Array<{ value: DatabaseProvider; label: string }> = [
  { value: 'sqlite', label: 'SQLite' },
  { value: 'firestore', label: 'Firestore' }
];

export const DEFAULT_SQLITE_SETTINGS: SqliteSettings = {
  dbFilename: 'harborclient.db',
  legacyDbFilename: 'harbor-client.db',
  legacyUserDataDir: 'harbor-client'
};

export const DEFAULT_FIRESTORE_SETTINGS: FirestoreSettings = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
  email: '',
  password: ''
};

export const SETTINGS_SECTIONS: Array<{ value: SettingsSection; label: string }> = [
  { value: 'general', label: 'General' },
  { value: 'sqlite', label: 'SQLite' },
  { value: 'firestore', label: 'Firestore' }
];
