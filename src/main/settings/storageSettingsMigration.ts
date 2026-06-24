import type { LocalDatabase } from '#/main/storage/LocalDatabase';

const LEGACY_CONNECTIONS_KEY = 'databaseConnections';
const CONNECTIONS_KEY = 'storageConnections';
const LEGACY_ACTIVE_ID_KEY = 'activeDatabaseId';
const ACTIVE_ID_KEY = 'activeStorageId';
const LEGACY_SLOTS_KEY = 'databaseSlots';
const SLOTS_KEY = 'storageSlots';

/**
 * Copies a persisted setting from a legacy key to the new key when the new key is unset.
 *
 * @param database - Local database holding app settings.
 * @param legacyKey - Previous setting key name.
 * @param newKey - Current setting key name.
 */
function migrateSettingKey(database: LocalDatabase, legacyKey: string, newKey: string): void {
  const current = database.getSetting(newKey);
  if (current !== undefined && current.trim() !== '') {
    return;
  }

  const legacy = database.getSetting(legacyKey);
  if (legacy === undefined || legacy.trim() === '') {
    return;
  }

  database.setSetting(newKey, legacy);
  database.setSetting(legacyKey, '');
}

/**
 * Renames persisted storage-connection settings keys from the database-* names to storage-*.
 *
 * @param database - Local database holding app settings.
 */
export function migrateStorageSettingsKeys(database: LocalDatabase): void {
  migrateSettingKey(database, LEGACY_CONNECTIONS_KEY, CONNECTIONS_KEY);
  migrateSettingKey(database, LEGACY_ACTIVE_ID_KEY, ACTIVE_ID_KEY);
  migrateSettingKey(database, LEGACY_SLOTS_KEY, SLOTS_KEY);
}
