import type { IStorage } from '@harborclient/core/storage/IStorage';
import type { LocalDatabase } from './LocalDatabase';

/**
 * Backend details required while migrating legacy local data into routed storage.
 */
interface MigrationBackend {
  connectionId: string;
  connectionName: string;
  db: IStorage;
}

/**
 * Router operations required by the one-time storage migration.
 */
export interface MigrationInternals {
  database: LocalDatabase;
  resolveDefaultDataBackend(): MigrationBackend;
  listBackends(): MigrationBackend[];
}

const MIGRATION_FLAG_KEY = '__migrated__';
const SNIPPET_MIGRATION_FLAG_KEY = '__snippets_migrated__';
const LIVE_SERVER_MIGRATION_FLAG = '__live_servers_migrated__';
const LIVE_PAGE_MIGRATION_FLAG = '__live_pages_migrated__';
const THEME_SETTING_KEY = 'theme';

/**
 * Performs one-time registry backfill from legacy and provider data on first run.
 */
export class MigrationManager {
  private readonly internals: MigrationInternals;

  /**
   * @param internals - Shared routing context from the host application.
   */
  constructor(internals: MigrationInternals) {
    this.internals = internals;
  }

  /**
   * Backfills the registry from existing provider data on first run.
   *
   * @param legacyProviderDbPath - Path to the user SQLite provider file for legacy registry migration.
   */
  async migrateRegistryIfNeeded(legacyProviderDbPath: string): Promise<void> {
    if (this.internals.database.getSetting(MIGRATION_FLAG_KEY) !== '1') {
      const defaultBackend = this.internals.resolveDefaultDataBackend();

      if (this.internals.database.listRegistry().length === 0) {
        const legacyCount =
          this.internals.database.migrateFromLegacyProviderDb(legacyProviderDbPath);
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

    await this.migrateSnippetRegistryIfNeeded();
    await this.migrateLiveServerRegistryIfNeeded();
    await this.migrateLivePageRegistryIfNeeded();
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
            undefined,
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

  /**
   * Moves legacy local live servers into the default provider and routing registry.
   */
  async migrateLiveServerRegistryIfNeeded(): Promise<void> {
    if (this.internals.database.getSetting(LIVE_SERVER_MIGRATION_FLAG) === '1') {
      return;
    }

    const legacyServers = this.internals.database.listLiveServers();
    if (legacyServers.length > 0) {
      const defaultBackend = this.internals.resolveDefaultDataBackend();
      for (const legacy of legacyServers) {
        try {
          const created = await defaultBackend.db.createLiveServer({
            ...legacy,
            uuid: legacy.uuid,
            lastOpenedPath: null
          });
          if (legacy.lastOpenedPath != null) {
            this.internals.database.setLiveServerLocalLastOpenedPath(
              created.uuid,
              legacy.lastOpenedPath
            );
          }
          this.internals.database.addLiveServerRegistryEntry({
            id: legacy.id,
            name: created.name,
            connectionId: defaultBackend.connectionId,
            providerLiveServerId: created.id,
            uuid: created.uuid
          });
          this.internals.database.deleteLiveServer(legacy.id);
        } catch (err) {
          console.warn(`Failed to migrate legacy live server "${legacy.name}":`, err);
        }
      }
    }

    this.internals.database.setSetting(LIVE_SERVER_MIGRATION_FLAG, '1');
  }

  /**
   * Moves legacy local live pages into the default provider and routing registry.
   */
  async migrateLivePageRegistryIfNeeded(): Promise<void> {
    if (this.internals.database.getSetting(LIVE_PAGE_MIGRATION_FLAG) === '1') {
      return;
    }

    const legacyPages = this.internals.database.listWebsites();
    if (legacyPages.length > 0) {
      const defaultBackend = this.internals.resolveDefaultDataBackend();
      for (const legacy of legacyPages) {
        try {
          const created = await defaultBackend.db.createLivePage({
            ...legacy,
            uuid: legacy.uuid
          });
          this.internals.database.addLivePageRegistryEntry({
            id: legacy.id,
            name: created.name,
            connectionId: defaultBackend.connectionId,
            providerLivePageId: created.id,
            uuid: created.uuid
          });
          this.internals.database.deleteWebsite(legacy.id);
        } catch (err) {
          console.warn(`Failed to migrate legacy live page "${legacy.name}":`, err);
        }
      }
    }

    this.internals.database.setSetting(LIVE_PAGE_MIGRATION_FLAG, '1');
  }
}
