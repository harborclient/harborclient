import type { RoutingInternals } from '#/main/storage/routingInternals';

const MIGRATION_FLAG_KEY = '__migrated__';
const SNIPPET_MIGRATION_FLAG_KEY = '__snippets_migrated__';
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
    await this.migrateSnippetRegistryIfNeeded();
  }

  /**
   * Moves legacy local snippet rows into the default provider and registry.
   */
  async migrateSnippetRegistryIfNeeded(): Promise<void> {
    if (this.internals.database.getSetting(SNIPPET_MIGRATION_FLAG_KEY) === '1') {
      return;
    }

    const legacySnippets = this.internals.database.listLegacyLocalSnippets();
    if (legacySnippets.length > 0) {
      const defaultBackend = this.internals.resolveDefaultDataBackend();
      for (const legacy of legacySnippets) {
        try {
          const created = await defaultBackend.db.createSnippet(
            legacy.name,
            legacy.code,
            legacy.scope,
            legacy.uuid
          );
          this.internals.database.addSnippetRegistryEntry({
            id: legacy.id,
            name: created.name,
            connectionId: defaultBackend.connectionId,
            providerSnippetId: created.id,
            uuid: created.uuid,
            scope: created.scope
          });
          this.internals.database.deleteLegacyLocalSnippet(legacy.id);
        } catch (err) {
          console.warn(`Failed to migrate legacy snippet "${legacy.name}":`, err);
        }
      }
    }

    this.internals.database.setSetting(SNIPPET_MIGRATION_FLAG_KEY, '1');
  }
}
