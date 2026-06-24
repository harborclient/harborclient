import type { RoutingInternals } from '#/main/storage/routingInternals';

const MIGRATION_FLAG_KEY = '__migrated__';
const THEME_SETTING_KEY = 'theme';

/**
 * Performs one-time registry backfill from legacy and provider data on first run.
 */
export class MigrationManager {
  private readonly internals: RoutingInternals;

  /**
   * @param internals - Shared routing context from RoutingStorage.
   */
  constructor(internals: RoutingInternals) {
    this.internals = internals;
  }

  /**
   * Backfills the registry from existing provider data on first run.
   *
   * @param legacyProviderDbPath - Path to the user SQLite provider file for legacy registry migration.
   */
  async migrateRegistryIfNeeded(legacyProviderDbPath: string): Promise<void> {
    if (this.internals.database.getSetting(MIGRATION_FLAG_KEY) === '1') {
      return;
    }

    const defaultBackend = this.internals.resolveDefaultDataBackend();

    if (this.internals.database.listRegistry().length === 0) {
      const legacyCount = this.internals.database.migrateFromLegacyProviderDb(legacyProviderDbPath);
      if (legacyCount === 0) {
        const defaultCollections = await defaultBackend.db.listCollections();
        for (const collection of defaultCollections) {
          this.internals.database.addRegistryEntry({
            id: collection.id,
            name: collection.name,
            connectionId: defaultBackend.connectionId,
            providerCollectionId: collection.id,
            collectionUuid: collection.uuid
          });
        }

        for (const backend of this.internals.listBackends()) {
          if (backend.connectionId === defaultBackend.connectionId) continue;
          try {
            const collections = await backend.db.listCollections();
            for (const collection of collections) {
              this.internals.database.addRegistryEntry({
                name: collection.name,
                connectionId: backend.connectionId,
                providerCollectionId: collection.id,
                collectionUuid: collection.uuid
              });
            }
          } catch (err) {
            console.warn(`Failed to migrate collections from "${backend.connectionName}":`, err);
          }
        }
      }
    }

    if (this.internals.database.listEnvironments().length === 0) {
      try {
        const environments = await defaultBackend.db.listEnvironments();
        for (const environment of environments) {
          this.internals.database.seedEnvironment(environment);
        }
      } catch (err) {
        console.warn('Failed to migrate environments from default provider:', err);
      }
    }

    const theme = await defaultBackend.db.getSetting(THEME_SETTING_KEY);
    if (theme != null && this.internals.database.getSetting(THEME_SETTING_KEY) == null) {
      this.internals.database.setSetting(THEME_SETTING_KEY, theme);
    }

    this.internals.database.setSetting(MIGRATION_FLAG_KEY, '1');
  }
}
