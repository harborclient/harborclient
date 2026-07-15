import Store from 'electron-store';
import { normalizeSqliteFilename } from './sqliteFilename';
import type { SqliteSettings } from '#/shared/types';

const DEFAULT_SQLITE_SETTINGS: SqliteSettings = {
  dbFilename: 'harborclient.db',
  legacyDbFilename: 'harbor-client.db',
  legacyUserDataDir: 'harbor-client'
};

const STORE_KEY = 'sqlite';

let store: Store<{ sqlite: SqliteSettings }> | null = null;

/**
 * Returns the lazy electron-store instance for SQLite settings.
 */
function getStore(): Store<{ sqlite: SqliteSettings }> {
  if (!store) {
    store = new Store<{ sqlite: SqliteSettings }>({
      name: 'settings',
      defaults: {
        sqlite: DEFAULT_SQLITE_SETTINGS
      }
    });
  }
  return store;
}

/**
 * Normalizes a settings field, falling back to the default when blank.
 *
 * @param value - Raw field value from storage or input.
 * @param fallback - Default when value is empty after trim.
 */
function normalizeField(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed || fallback;
}

/**
 * Normalizes a SQLite settings object with defaults for blank fields.
 *
 * @param input - Raw settings from storage or user input.
 * @returns Normalized settings.
 */
function normalizeSettings(input: Partial<SqliteSettings>): SqliteSettings {
  return {
    dbFilename: normalizeSqliteFilename(input.dbFilename ?? '', DEFAULT_SQLITE_SETTINGS.dbFilename),
    legacyDbFilename: normalizeSqliteFilename(
      input.legacyDbFilename ?? '',
      DEFAULT_SQLITE_SETTINGS.legacyDbFilename
    ),
    legacyUserDataDir: normalizeField(
      input.legacyUserDataDir ?? '',
      DEFAULT_SQLITE_SETTINGS.legacyUserDataDir
    )
  };
}

/**
 * Reads persisted SQLite path and legacy migration settings.
 *
 * @returns Current SQLite settings with defaults applied.
 */
export function getSqliteSettings(): SqliteSettings {
  const stored = getStore().get(STORE_KEY, DEFAULT_SQLITE_SETTINGS);
  return normalizeSettings(stored);
}

/**
 * Persists SQLite path and legacy migration settings.
 *
 * @param input - Settings to store.
 */
export function setSqliteSettings(input: SqliteSettings): void {
  getStore().set(STORE_KEY, normalizeSettings(input));
}
