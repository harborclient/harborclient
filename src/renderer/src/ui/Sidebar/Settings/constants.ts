import type {
  DatabaseConnection,
  DatabaseProvider,
  FirestoreSettings,
  GeneralSettings,
  MySqlSettings,
  PostgresSettings,
  SqliteSettings,
  ThemeSource
} from '#/shared/types';
import type { SettingsSection } from './types';

export const THEME_OPTIONS: Array<{ value: ThemeSource; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
];

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  requestTimeoutMs: 30000,
  maxResponseSizeMb: 50,
  verifySsl: true
};

export const PROVIDER_OPTIONS: Array<{ value: DatabaseProvider; label: string }> = [
  { value: 'sqlite', label: 'SQLite' },
  { value: 'firestore', label: 'Firestore' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgres', label: 'PostgreSQL' }
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

export const DEFAULT_MYSQL_SETTINGS: MySqlSettings = {
  host: '127.0.0.1',
  port: 3306,
  user: '',
  password: '',
  database: ''
};

export const DEFAULT_POSTGRES_SETTINGS: PostgresSettings = {
  host: '127.0.0.1',
  port: 5432,
  user: '',
  password: '',
  database: ''
};

export const SETTINGS_SECTIONS: Array<{ value: SettingsSection; label: string }> = [
  { value: 'general', label: 'General' },
  { value: 'databases', label: 'Databases' }
];

/**
 * Returns the display label for a database provider type.
 *
 * @param type - Database provider type.
 */
export function providerLabel(type: DatabaseProvider): string {
  return PROVIDER_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

/**
 * Creates a blank database connection for the given provider type.
 *
 * @param type - Database provider type.
 */
export function createBlankConnection(type: DatabaseProvider): DatabaseConnection {
  switch (type) {
    case 'sqlite':
      return { id: '', name: '', type: 'sqlite', settings: { ...DEFAULT_SQLITE_SETTINGS } };
    case 'firestore':
      return { id: '', name: '', type: 'firestore', settings: { ...DEFAULT_FIRESTORE_SETTINGS } };
    case 'mysql':
      return { id: '', name: '', type: 'mysql', settings: { ...DEFAULT_MYSQL_SETTINGS } };
    case 'postgres':
      return { id: '', name: '', type: 'postgres', settings: { ...DEFAULT_POSTGRES_SETTINGS } };
  }
}
