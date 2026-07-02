import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type {
  AiSettings,
  StorageConnection,
  StorageProvider,
  FirestoreSettings,
  GeneralSettings,
  GitSettings,
  MySqlSettings,
  PostgresSettings,
  ProxySettings,
  SqliteSettings
} from '#/shared/types';
import { DEFAULT_CODE_EDITOR_SETUP } from '#/shared/codeEditorSettings';
import {
  faCode,
  faDatabase,
  faFileCode,
  faFloppyDisk,
  faGear,
  faGlobe,
  faKeyboard,
  faRobot,
  faServer
} from '#/renderer/src/fontawesome';
import type { SettingsSection } from './types';

/**
 * Baseline proxy configuration used when proxy is disabled or reset.
 */
export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  enabled: false,
  protocol: 'http',
  host: '',
  port: 8080,
  authEnabled: false,
  username: '',
  password: ''
};

/**
 * Factory defaults for app-wide General settings (timeouts, editor, SSL, proxy).
 */
export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  requestTimeoutMs: 30000,
  maxResponseSizeMb: 50,
  verifySsl: true,
  followRedirects: true,
  warnWhenSwitchingThemes: true,
  codeEditorTheme: 'default',
  codeEditorSetup: { ...DEFAULT_CODE_EDITOR_SETUP },
  proxy: { ...DEFAULT_PROXY_SETTINGS },
  globalVariables: []
};

/**
 * Select options for the proxy protocol field in Proxy settings.
 */
export const PROXY_PROTOCOL_OPTIONS: Array<{ value: ProxySettings['protocol']; label: string }> = [
  { value: 'http', label: 'HTTP' },
  { value: 'https', label: 'HTTPS' }
];

/**
 * Select options for database provider type when adding or editing a connection.
 */
export const PROVIDER_OPTIONS: Array<{ value: StorageProvider; label: string }> = [
  { value: 'sqlite', label: 'SQLite' },
  { value: 'git', label: 'Git' },
  { value: 'firestore', label: 'Firestore' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'postgres', label: 'PostgreSQL' }
];

/**
 * Initial SQLite connection settings for new local database connections.
 */
export const DEFAULT_SQLITE_SETTINGS: SqliteSettings = {
  dbFilename: 'harborclient.db',
  legacyDbFilename: 'harbor-client.db',
  legacyUserDataDir: 'harbor-client'
};

/**
 * Blank Firestore credentials and project fields for a new remote connection.
 */
export const DEFAULT_FIRESTORE_SETTINGS: FirestoreSettings = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
  email: '',
  password: ''
};

/**
 * Sensible localhost defaults for a new MySQL connection form.
 */
export const DEFAULT_MYSQL_SETTINGS: MySqlSettings = {
  host: '127.0.0.1',
  port: 3306,
  user: '',
  password: '',
  database: ''
};

/**
 * Sensible localhost defaults for a new PostgreSQL connection form.
 */
export const DEFAULT_POSTGRES_SETTINGS: PostgresSettings = {
  host: '127.0.0.1',
  port: 5432,
  user: '',
  password: '',
  database: ''
};

/**
 * Initial Git-backed storage settings for a new repository connection.
 */
export const DEFAULT_GIT_SETTINGS: GitSettings = {
  repoPath: '',
  url: '',
  branch: 'main',
  subdir: '.harborclient',
  auth: { kind: 'pat', username: 'token' }
};

/**
 * Empty API key placeholders for AI provider settings.
 */
export const DEFAULT_AI_SETTINGS: AiSettings = {
  openaiApiKey: '',
  claudeApiKey: '',
  geminiApiKey: ''
};

/**
 * Sidebar navigation entries for the Settings screen (order, labels, and icons).
 */
export const SETTINGS_SECTIONS: Array<{
  value: SettingsSection;
  label: string;
  icon: IconDefinition;
}> = [
  { value: 'general', label: 'General', icon: faGear },
  { value: 'globals', label: 'Globals', icon: faGlobe },
  { value: 'snippets', label: 'Snippets', icon: faFileCode },
  { value: 'storage', label: 'Storage', icon: faDatabase },
  { value: 'shortcuts', label: 'Shortcuts', icon: faKeyboard },
  { value: 'syntax', label: 'Syntax highlighting', icon: faCode },
  { value: 'ai', label: 'AI', icon: faRobot },
  { value: 'proxy', label: 'Proxy', icon: faServer },
  { value: 'backup-restore', label: 'Backup & Restore', icon: faFloppyDisk }
];

/**
 * Returns sidebar label and icon metadata for a built-in settings section.
 *
 * @param value - Built-in settings section id.
 * @returns Matching sidebar entry from {@link SETTINGS_SECTIONS}.
 * @throws When `value` is not a built-in section id.
 */
export function settingsSectionMeta(value: SettingsSection): (typeof SETTINGS_SECTIONS)[number] {
  const section = SETTINGS_SECTIONS.find((entry) => entry.value === value);
  if (!section) {
    throw new Error(`Unknown settings section: ${value}`);
  }
  return section;
}

/**
 * Returns the display label for a database provider type.
 *
 * @param type - Database provider type.
 */
export function providerLabel(type: StorageProvider): string {
  return PROVIDER_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

/**
 * Creates a blank database connection for the given provider type.
 *
 * @param type - Database provider type.
 */
export function createBlankConnection(type: StorageProvider): StorageConnection {
  switch (type) {
    case 'sqlite':
      return { id: '', name: '', type: 'sqlite', settings: { ...DEFAULT_SQLITE_SETTINGS } };
    case 'firestore':
      return { id: '', name: '', type: 'firestore', settings: { ...DEFAULT_FIRESTORE_SETTINGS } };
    case 'mysql':
      return { id: '', name: '', type: 'mysql', settings: { ...DEFAULT_MYSQL_SETTINGS } };
    case 'postgres':
      return { id: '', name: '', type: 'postgres', settings: { ...DEFAULT_POSTGRES_SETTINGS } };
    case 'git':
      return { id: '', name: '', type: 'git', settings: { ...DEFAULT_GIT_SETTINGS } };
  }
}
