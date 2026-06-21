import { MoveCoordinator } from '#/main/db/CollectionMover';
import { LocalRegistry, type CollectionRegistryEntry } from '#/main/db/LocalRegistry';
import { MigrationManager } from '#/main/db/RegistryMigrator';
import { createDatabaseInstance } from '#/main/db/createDatabaseInstance';
import { decodeGlobalId, encodeGlobalId } from '#/main/db/idNamespace';
import type { IDatabase } from '#/main/db/IDatabase';
import type { MountedBackend, RoutingInternals } from '#/main/db/routingInternals';
import type {
  AuthConfig,
  Collection,
  CollectionExport,
  DatabaseConnection,
  Environment,
  Folder,
  KeyValue,
  SaveRequestInput,
  SavedRequest,
  Variable
} from '#/shared/types';
import { defaultAuth } from '#/shared/auth';

/**
 * Formats a backend error for user-facing collection list warnings.
 *
 * @param err - Error thrown while reading collections from a provider.
 * @returns A short message suitable for toast display.
 */
function formatListCollectionError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/**
 * Routes collection and request operations across multiple database backends.
 *
 * A hidden LocalRegistry holds the authoritative collection list,
 * environments, and app settings. Collection data and requests live in the
 * mapped provider. Request ids are namespaced per backend; collection ids
 * come from the registry.
 */
export class RoutingDatabase implements IDatabase {
  private readonly registry: LocalRegistry;
  private defaultDataConnectionId: string;
  private readonly byConnectionId = new Map<string, MountedBackend>();
  private readonly bySlot = new Map<number, MountedBackend>();
  private listCollectionWarnings: string[] = [];
  private internalsCache?: RoutingInternals;
  private moverCache?: MoveCoordinator;
  private migratorCache?: MigrationManager;

  /**
   * @param registry - Hidden local store for collection metadata, environments, and settings.
   * @param defaultDataConnectionId - Preferred provider for new collection data.
   */
  constructor(registry: LocalRegistry, defaultDataConnectionId: string) {
    this.registry = registry;
    this.defaultDataConnectionId = defaultDataConnectionId;
  }

  /**
   * Lazily constructed move coordinator sharing this router's internal context.
   */
  private get mover(): MoveCoordinator {
    return (this.moverCache ??= new MoveCoordinator(this.internals));
  }

  /**
   * Lazily constructed migration manager sharing this router's internal context.
   */
  private get migrator(): MigrationManager {
    return (this.migratorCache ??= new MigrationManager(this.internals));
  }

  /**
   * Shared internal context for move and migration helpers.
   */
  private get internals(): RoutingInternals {
    return (this.internalsCache ??= this.createInternals());
  }

  /**
   * Registers an initialized backend at the given slot.
   */
  mount(slot: number, connection: DatabaseConnection, db: IDatabase): void {
    const backend: MountedBackend = {
      slot,
      connectionId: connection.id,
      connectionName: connection.name,
      connectionType: connection.type,
      db
    };
    this.byConnectionId.set(connection.id, backend);
    this.bySlot.set(slot, backend);
  }

  /**
   * Returns true when at least one data provider backend is mounted.
   */
  hasAnyBackend(): boolean {
    return this.byConnectionId.size > 0;
  }

  /**
   * Returns true when the default data provider is mounted.
   */
  hasDefaultProvider(): boolean {
    return this.byConnectionId.has(this.defaultDataConnectionId);
  }

  /**
   * Sets the default data connection id when the preferred provider is unavailable.
   */
  setDefaultDataConnectionId(connectionId: string): void {
    this.defaultDataConnectionId = connectionId;
  }

  /**
   * Initializes all mounted backends (no-op; backends are initialized before mount).
   */
  async init(): Promise<void> {
    // Backends are initialized before being mounted.
  }

  /**
   * Closes every mounted provider and the registry.
   */
  async close(): Promise<void> {
    await Promise.all([...this.byConnectionId.values()].map((backend) => backend.db.close()));
    await this.registry.close();
  }

  /**
   * Returns and clears warnings recorded during the most recent listCollections call.
   */
  consumeCollectionListWarnings(): string[] {
    const warnings = this.listCollectionWarnings;
    this.listCollectionWarnings = [];
    return warnings;
  }

  /**
   * Lists all collections from the registry, hydrating data from each provider.
   */
  async listCollections(): Promise<Collection[]> {
    this.listCollectionWarnings = [];
    const entries = this.registry.listRegistry();

    const recordsByConnection = new Map<string, Map<number, Collection>>();
    const neededConnectionIds = new Set(entries.map((entry) => entry.connectionId));

    for (const connectionId of neededConnectionIds) {
      const backend = this.byConnectionId.get(connectionId);
      if (!backend) {
        this.listCollectionWarnings.push(
          `Could not load collection data: database connection "${connectionId}" is unavailable.`
        );
        continue;
      }
      try {
        const records = await backend.db.listCollections();
        recordsByConnection.set(
          connectionId,
          new Map(records.map((record) => [record.id, record]))
        );
      } catch (err) {
        console.warn(`Failed to read collections from "${backend.connectionName}":`, err);
        this.listCollectionWarnings.push(
          `Could not load collections from "${backend.connectionName}": ${formatListCollectionError(err)}`
        );
      }
    }

    return entries.map((entry) => {
      const record = recordsByConnection.get(entry.connectionId)?.get(entry.providerCollectionId);
      return this.buildCollection(entry, record);
    });
  }

  /**
   * Creates a collection in the default data provider and registers it.
   */
  async createCollection(name: string): Promise<Collection> {
    const backend = this.requireDefaultDataBackend();
    const created = await backend.db.createCollection(name);
    try {
      const entry = this.registry.addRegistryEntry({
        name: created.name,
        connectionId: backend.connectionId,
        providerCollectionId: created.id
      });
      return this.buildCollection(entry, created);
    } catch (err) {
      await this.compensateProviderCollectionCreate(backend, created.id);
      throw err;
    }
  }

  /**
   * Updates a collection's data in its provider and its name in the registry.
   */
  async updateCollection(
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string,
    auth: AuthConfig
  ): Promise<Collection> {
    const entry = this.requireEntry(id);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const record = await backend.db.updateCollection(
      entry.providerCollectionId,
      name,
      variables,
      headers,
      preRequestScript,
      postRequestScript,
      auth
    );
    const updatedEntry = this.registry.updateRegistryEntry(id, { name });
    return this.buildCollection(updatedEntry, record);
  }

  /**
   * Deletes a collection from its provider and the registry.
   */
  async deleteCollection(id: number): Promise<void> {
    const entry = this.requireEntry(id);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    await backend.db.deleteCollection(entry.providerCollectionId);
    this.registry.deleteRegistryEntry(id);
  }

  /**
   * Lists environments from the hidden registry.
   */
  async listEnvironments(): Promise<Environment[]> {
    return this.registry.listEnvironments();
  }

  /**
   * Creates an environment in the hidden registry.
   */
  async createEnvironment(name: string): Promise<Environment> {
    return this.registry.createEnvironment(name);
  }

  /**
   * Updates an environment in the hidden registry.
   */
  async updateEnvironment(id: number, name: string, variables: Variable[]): Promise<Environment> {
    return this.registry.updateEnvironment(id, name, variables);
  }

  /**
   * Deletes an environment from the hidden registry.
   */
  async deleteEnvironment(id: number): Promise<void> {
    this.registry.deleteEnvironment(id);
  }

  /**
   * Lists requests for a collection, rewriting ids to the global namespace.
   */
  async listRequests(collectionId: number): Promise<SavedRequest[]> {
    const entry = this.requireEntry(collectionId);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const requests = await backend.db.listRequests(entry.providerCollectionId);
    return requests.map((request) => this.toGlobalRequest(request, backend, collectionId));
  }

  /**
   * Saves a request in the backend that owns the target collection.
   */
  async saveRequest(input: SaveRequestInput): Promise<SavedRequest> {
    const entry = this.requireEntry(input.collection_id);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const localRequestId =
      input.id != null ? this.decodeLocalIdForBackend(input.id, backend) : undefined;
    const localFolderId =
      input.folder_id != null
        ? this.decodeLocalIdForBackend(input.folder_id, backend)
        : input.folder_id;

    const saved = await backend.db.saveRequest({
      ...input,
      id: localRequestId,
      collection_id: entry.providerCollectionId,
      folder_id: localFolderId ?? null
    });
    return this.toGlobalRequest(saved, backend, input.collection_id);
  }

  /**
   * Deletes a request from the backend identified by its namespaced id.
   */
  async deleteRequest(id: number): Promise<void> {
    const { slot, localId } = decodeGlobalId(id);
    const backend = this.bySlot.get(slot);
    if (!backend) {
      throw new Error(`Database backend for slot ${slot} is unavailable.`);
    }
    await backend.db.deleteRequest(localId);
  }

  /**
   * Lists all folders in a collection.
   *
   * @param collectionId - Collection to query.
   * @returns Folders ordered by sort_order then name.
   */
  async listFolders(collectionId: number): Promise<Folder[]> {
    const entry = this.requireEntry(collectionId);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const folders = await backend.db.listFolders(entry.providerCollectionId);
    return folders.map((folder) => this.toGlobalFolder(folder, backend, collectionId));
  }

  /**
   * Creates a new folder in a collection.
   *
   * @param collectionId - Collection to add the folder to.
   * @param name - Display name for the folder.
   * @returns The newly created folder.
   */
  async createFolder(collectionId: number, name: string): Promise<Folder> {
    const entry = this.requireEntry(collectionId);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const created = await backend.db.createFolder(entry.providerCollectionId, name);
    return this.toGlobalFolder(created, backend, collectionId);
  }

  /**
   * Renames a folder.
   *
   * @param id - Folder ID to rename.
   * @param name - New display name.
   * @returns The updated folder.
   */
  async renameFolder(id: number, name: string): Promise<Folder> {
    const { slot, localId } = decodeGlobalId(id);
    const backend = this.bySlot.get(slot);
    if (!backend) {
      throw new Error(`Database backend for slot ${slot} is unavailable.`);
    }
    const updated = await backend.db.renameFolder(localId, name);
    const entry = this.findEntryForBackendCollection(backend.connectionId, updated.collection_id);
    const globalCollectionId = entry?.id ?? updated.collection_id;
    return this.toGlobalFolder(updated, backend, globalCollectionId);
  }

  /**
   * Deletes a folder and all requests inside it.
   *
   * @param id - Folder ID to delete.
   */
  async deleteFolder(id: number): Promise<void> {
    const { slot, localId } = decodeGlobalId(id);
    const backend = this.bySlot.get(slot);
    if (!backend) {
      throw new Error(`Database backend for slot ${slot} is unavailable.`);
    }
    await backend.db.deleteFolder(localId);
  }

  /**
   * Reorders folders within a collection.
   *
   * @param collectionId - Collection containing the folders.
   * @param orderedFolderIds - Folder IDs in desired order.
   */
  async reorderFolders(collectionId: number, orderedFolderIds: number[]): Promise<void> {
    const entry = this.requireEntry(collectionId);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const localIds = orderedFolderIds.map((folderId) =>
      this.decodeLocalIdForBackend(folderId, backend)
    );
    await backend.db.reorderFolders(entry.providerCollectionId, localIds);
  }

  /**
   * Reorders requests within a folder or at collection root.
   *
   * @param collectionId - Collection containing the requests.
   * @param folderId - Folder ID, or null for root-level requests.
   * @param orderedRequestIds - Request IDs in desired order.
   */
  async reorderRequests(
    collectionId: number,
    folderId: number | null,
    orderedRequestIds: number[]
  ): Promise<void> {
    const entry = this.requireEntry(collectionId);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    const localFolderId = folderId != null ? this.decodeLocalIdForBackend(folderId, backend) : null;
    const localRequestIds = orderedRequestIds.map((requestId) =>
      this.decodeLocalIdForBackend(requestId, backend)
    );
    await backend.db.reorderRequests(entry.providerCollectionId, localFolderId, localRequestIds);
  }

  /**
   * Moves a request to another folder or collection root at a given index.
   *
   * @param requestId - Request ID to move.
   * @param folderId - Destination folder ID, or null for collection root.
   * @param index - Zero-based position within the destination container.
   */
  async moveRequest(requestId: number, folderId: number | null, index: number): Promise<void> {
    const { slot, localId } = decodeGlobalId(requestId);
    const backend = this.bySlot.get(slot);
    if (!backend) {
      throw new Error(`Database backend for slot ${slot} is unavailable.`);
    }
    const localFolderId = folderId != null ? decodeGlobalId(folderId).localId : null;
    await backend.db.moveRequest(localId, localFolderId, index);
  }

  /**
   * Exports collection data from its owning provider.
   */
  async exportCollectionData(id: number): Promise<CollectionExport> {
    const entry = this.requireEntry(id);
    const backend = this.requireBackendByConnectionId(entry.connectionId);
    return backend.db.exportCollectionData(entry.providerCollectionId);
  }

  /**
   * Imports a collection into the default data provider and registers it.
   */
  async importCollectionData(data: unknown): Promise<Collection> {
    const backend = this.requireDefaultDataBackend();
    const imported = await backend.db.importCollectionData(data);
    try {
      const entry = this.registry.addRegistryEntry({
        name: imported.name,
        connectionId: backend.connectionId,
        providerCollectionId: imported.id
      });
      return this.buildCollection(entry, imported);
    } catch (err) {
      await this.compensateProviderCollectionCreate(backend, imported.id);
      throw err;
    }
  }

  /**
   * Reads a setting from the hidden registry.
   */
  async getSetting(key: string): Promise<string | undefined> {
    return this.registry.getSetting(key);
  }

  /**
   * Persists a setting in the hidden registry.
   */
  async setSetting(key: string, value: string): Promise<void> {
    this.registry.setSetting(key, value);
  }

  /**
   * Moves a collection's data to another provider, keeping its global id stable.
   */
  async moveCollection(
    globalCollectionId: number,
    targetConnectionId: string
  ): Promise<Collection> {
    return this.mover.moveCollection(globalCollectionId, targetConnectionId);
  }

  /**
   * Deep-copies a collection into a new collection on the same backend.
   *
   * @param id - Global collection id to duplicate.
   * @returns The newly created collection with a new global id.
   */
  async duplicateCollection(id: number): Promise<Collection> {
    return this.mover.duplicateCollection(id);
  }

  /**
   * Persists a new sidebar order for collections in the local registry.
   *
   * @param orderedCollectionIds - Global collection ids in desired order.
   */
  async reorderCollections(orderedCollectionIds: number[]): Promise<void> {
    this.registry.reorderRegistry(orderedCollectionIds);
  }

  /**
   * Deletes stale source copies left behind by interrupted collection moves.
   */
  async recoverPendingMoveCleanups(): Promise<void> {
    return this.mover.recoverPendingMoveCleanups();
  }

  /**
   * Returns the sharing metadata for a collection: its owning connection and provider id.
   *
   * @param globalCollectionId - Global (registry) collection id.
   */
  getShareInfo(globalCollectionId: number): {
    connectionId: string;
    name: string;
    providerCollectionId: number;
  } {
    const entry = this.requireEntry(globalCollectionId);
    return {
      connectionId: entry.connectionId,
      name: entry.name,
      providerCollectionId: entry.providerCollectionId
    };
  }

  /**
   * Mounts a shared connection at runtime and registers a single shared collection.
   *
   * @param connection - Connection configuration to mount.
   * @param slot - Backend slot for request id namespacing.
   * @param userDataPath - Electron userData path for SQLite file storage.
   * @param meta - Shared collection name and provider id from the invite.
   * @returns The registered collection.
   */
  async registerSharedCollection(
    connection: DatabaseConnection,
    slot: number,
    userDataPath: string,
    meta: { name: string; providerCollectionId: number }
  ): Promise<Collection> {
    const alreadyMounted = this.byConnectionId.has(connection.id);
    if (!alreadyMounted) {
      const db = await createDatabaseInstance(connection, userDataPath);
      this.mount(slot, connection, db);
    }

    const existing = this.registry
      .listRegistry()
      .find(
        (entry) =>
          entry.connectionId === connection.id &&
          entry.providerCollectionId === meta.providerCollectionId
      );

    const entry =
      existing ??
      this.registry.addRegistryEntry({
        name: meta.name,
        connectionId: connection.id,
        providerCollectionId: meta.providerCollectionId
      });

    const backend = this.requireBackendByConnectionId(connection.id);
    let record: Collection | undefined;
    try {
      const records = await backend.db.listCollections();
      record = records.find((item) => item.id === meta.providerCollectionId);
    } catch (err) {
      console.warn(`Failed to read collections from "${backend.connectionName}":`, err);
      this.listCollectionWarnings.push(
        `Could not load collections from "${backend.connectionName}": ${formatListCollectionError(err)}`
      );
    }

    return this.buildCollection(entry, record);
  }

  /**
   * Backfills the registry from existing provider data on first run.
   *
   * @param legacyProviderDbPath - Path to the user SQLite provider file for legacy registry migration.
   */
  async migrateRegistryIfNeeded(legacyProviderDbPath: string): Promise<void> {
    return this.migrator.migrateRegistryIfNeeded(legacyProviderDbPath);
  }

  /**
   * Creates and mounts every configured connection, skipping failures gracefully.
   */
  static async create(
    registry: LocalRegistry,
    preferredConnectionId: string,
    connections: DatabaseConnection[],
    slots: Record<string, number>,
    userDataPath: string
  ): Promise<RoutingDatabase> {
    const defaultDataConnectionId = RoutingDatabase.resolveDefaultConnectionId(
      preferredConnectionId,
      connections
    );
    const router = new RoutingDatabase(registry, defaultDataConnectionId);

    for (const connection of connections) {
      const slot = slots[connection.id];
      if (slot === undefined) continue;

      try {
        const db = await createDatabaseInstance(connection, userDataPath);
        router.mount(slot, connection, db);
      } catch (err) {
        console.warn(
          `Failed to initialize database "${connection.name}" (${connection.type}):`,
          err
        );
      }
    }

    if (!router.hasDefaultProvider()) {
      const fallback = [...router.byConnectionId.values()].find(
        (backend) => backend.connectionType === 'sqlite'
      );
      if (fallback) {
        router.setDefaultDataConnectionId(fallback.connectionId);
      } else {
        const first = router.byConnectionId.values().next().value;
        if (first) {
          router.setDefaultDataConnectionId(first.connectionId);
        }
      }
    }

    await router.recoverPendingMoveCleanups();

    return router;
  }

  private static resolveDefaultConnectionId(
    preferredConnectionId: string,
    connections: DatabaseConnection[]
  ): string {
    const preferred = connections.find((conn) => conn.id === preferredConnectionId);
    if (preferred) {
      return preferredConnectionId;
    }

    const sqlite = connections.find((conn) => conn.type === 'sqlite');
    if (sqlite) {
      return sqlite.id;
    }

    return connections[0]?.id ?? preferredConnectionId;
  }

  /**
   * Deletes a provider collection when registry registration fails after create/import.
   *
   * @param backend - Backend that owns the orphaned provider collection.
   * @param providerCollectionId - Provider-local collection id to remove.
   */
  private async compensateProviderCollectionCreate(
    backend: MountedBackend,
    providerCollectionId: number
  ): Promise<void> {
    try {
      await backend.db.deleteCollection(providerCollectionId);
    } catch (cleanupErr) {
      console.warn(
        `Failed to clean up provider collection ${providerCollectionId} after registry failure:`,
        cleanupErr
      );
    }
  }

  /**
   * Merges registry metadata with backend collection record fields.
   *
   * @param entry - Registry entry for the collection.
   * @param record - Optional backend collection record.
   * @returns Combined Collection for the renderer.
   */
  private buildCollection(
    entry: CollectionRegistryEntry,
    record: Collection | undefined
  ): Collection {
    return {
      id: entry.id,
      name: entry.name,
      variables: record?.variables ?? [],
      headers: record?.headers ?? [],
      auth: record?.auth ?? defaultAuth(),
      pre_request_script: record?.pre_request_script ?? '',
      post_request_script: record?.post_request_script ?? '',
      created_at: record?.created_at ?? entry.created_at,
      connectionId: entry.connectionId
    };
  }

  /**
   * Encodes backend-scoped request ids into global ids for the UI.
   *
   * @param request - Backend-scoped saved request.
   * @param backend - Mounted backend that owns the request.
   * @param globalCollectionId - Encoded global collection id.
   * @returns Request with global ids.
   */
  private toGlobalRequest(
    request: SavedRequest,
    backend: MountedBackend,
    globalCollectionId: number
  ): SavedRequest {
    return {
      ...request,
      id: encodeGlobalId(backend.slot, request.id),
      collection_id: globalCollectionId,
      folder_id: request.folder_id != null ? encodeGlobalId(backend.slot, request.folder_id) : null
    };
  }

  /**
   * Encodes backend-scoped folder ids into global ids for the UI.
   *
   * @param folder - Backend-scoped folder.
   * @param backend - Mounted backend that owns the folder.
   * @param globalCollectionId - Encoded global collection id.
   * @returns Folder with global ids.
   */
  private toGlobalFolder(
    folder: Folder,
    backend: MountedBackend,
    globalCollectionId: number
  ): Folder {
    return {
      ...folder,
      id: encodeGlobalId(backend.slot, folder.id),
      collection_id: globalCollectionId
    };
  }

  /**
   * Decodes a global id and verifies it belongs to the expected backend slot.
   *
   * @param globalId - Namespaced id from the UI.
   * @param backend - Mounted backend that should own the id.
   * @returns Local id within that backend.
   * @throws When the id's slot does not match the backend.
   */
  private decodeLocalIdForBackend(globalId: number, backend: MountedBackend): number {
    const { slot, localId } = decodeGlobalId(globalId);
    if (slot !== backend.slot) {
      throw new Error(
        `Global id ${globalId} does not belong to backend slot ${backend.slot} (slot ${slot}).`
      );
    }
    return localId;
  }

  /**
   * Resolves the registry entry for a provider-scoped collection id.
   *
   * @param connectionId - Backend connection id.
   * @param providerCollectionId - Collection id within that backend.
   * @returns Matching registry entry, or undefined.
   */
  private findEntryForBackendCollection(
    connectionId: string,
    providerCollectionId: number
  ): CollectionRegistryEntry | undefined {
    return this.registry
      .listRegistry()
      .find(
        (entry) =>
          entry.connectionId === connectionId && entry.providerCollectionId === providerCollectionId
      );
  }

  /**
   * Chooses the default mounted backend for new collections.
   *
   * @returns The preferred or first available backend.
   * @throws When no backend is mounted.
   */
  private resolveDefaultDataBackend(): MountedBackend {
    if (this.byConnectionId.has(this.defaultDataConnectionId)) {
      return this.requireBackendByConnectionId(this.defaultDataConnectionId);
    }

    const sqlite = [...this.byConnectionId.values()].find(
      (backend) => backend.connectionType === 'sqlite'
    );
    if (sqlite) return sqlite;

    const first = this.byConnectionId.values().next().value;
    if (!first) {
      throw new Error('No database provider is available.');
    }
    return first;
  }

  /**
   * Returns the configured default data backend or throws.
   *
   * @returns The default mounted backend.
   * @throws When the default connection is unavailable.
   */
  private requireDefaultDataBackend(): MountedBackend {
    const backend = this.byConnectionId.get(this.defaultDataConnectionId);
    if (!backend) {
      throw new Error('Default database provider is unavailable.');
    }
    return backend;
  }

  /**
   * Returns a mounted backend by connection id or throws.
   *
   * @param connectionId - Connection id to resolve.
   * @returns The mounted backend.
   * @throws When the connection is unavailable.
   */
  private requireBackendByConnectionId(connectionId: string): MountedBackend {
    const backend = this.byConnectionId.get(connectionId);
    if (!backend) {
      throw new Error(`Database connection "${connectionId}" is unavailable.`);
    }
    return backend;
  }

  /**
   * Returns a registry entry by global id or throws.
   *
   * @param id - Global collection id.
   * @returns The registry entry.
   * @throws When the entry does not exist.
   */
  private requireEntry(id: number): CollectionRegistryEntry {
    const entry = this.registry.getRegistryEntry(id);
    if (!entry) {
      throw new Error(`Collection not found: ${id}`);
    }
    return entry;
  }

  /**
   * Builds the internal context object passed to move and migration helpers.
   *
   * @returns RoutingInternals with bound accessors to this router's private state.
   */
  private createInternals(): RoutingInternals {
    return {
      registry: this.registry,
      getBackend: (connectionId) => this.byConnectionId.get(connectionId),
      listBackends: () => [...this.byConnectionId.values()],
      requireBackendByConnectionId: (connectionId) =>
        this.requireBackendByConnectionId(connectionId),
      requireDefaultDataBackend: () => this.requireDefaultDataBackend(),
      resolveDefaultDataBackend: () => this.resolveDefaultDataBackend(),
      requireEntry: (id) => this.requireEntry(id),
      buildCollection: (entry, record) => this.buildCollection(entry, record)
    };
  }
}
