import { createDatabaseInstance } from '#/main/db/createDatabaseInstance';
import { decodeGlobalId, encodeGlobalId } from '#/main/db/idNamespace';
import type { IDatabase } from '#/main/db/IDatabase';
import type {
  Collection,
  CollectionExport,
  DatabaseConnection,
  DatabaseProvider,
  Environment,
  KeyValue,
  SaveRequestInput,
  SavedRequest,
  Variable
} from '#/shared/types';

interface MountedBackend {
  slot: number;
  connectionId: string;
  connectionName: string;
  connectionType: DatabaseProvider;
  db: IDatabase;
}

/**
 * Routes collection and request operations to mounted database backends,
 * namespacing numeric IDs so multiple backends can be active at once.
 */
export class RoutingDatabase implements IDatabase {
  private readonly primaryConnectionId: string;
  private readonly backends = new Map<number, MountedBackend>();

  /**
   * @param primaryConnectionId - Connection used for new collections, environments, and settings.
   */
  constructor(primaryConnectionId: string) {
    this.primaryConnectionId = primaryConnectionId;
  }

  /**
   * Registers an initialized backend at the given slot.
   */
  mount(slot: number, connection: DatabaseConnection, db: IDatabase): void {
    this.backends.set(slot, {
      slot,
      connectionId: connection.id,
      connectionName: connection.name,
      connectionType: connection.type,
      db
    });
  }

  /**
   * Returns true when at least one backend is mounted.
   */
  hasAnyBackend(): boolean {
    return this.backends.size > 0;
  }

  /**
   * Returns true when the primary connection backend is mounted, or a SQLite fallback is available.
   */
  hasPrimary(): boolean {
    return this.getEffectivePrimaryBackend() != null;
  }

  /**
   * Returns the primary connection id used for new collections and app settings.
   */
  getPrimaryConnectionId(): string {
    return this.primaryConnectionId;
  }

  /**
   * Initializes all mounted backends (no-op when none are mounted yet).
   */
  async init(): Promise<void> {
    // Backends are initialized before mount.
  }

  /**
   * Closes every mounted backend connection.
   */
  async close(): Promise<void> {
    await Promise.all([...this.backends.values()].map((backend) => backend.db.close()));
  }

  /**
   * Lists collections from all mounted backends with global ids and connection metadata.
   */
  async listCollections(): Promise<Collection[]> {
    const results: Collection[] = [];

    for (const backend of this.backends.values()) {
      const collections = await backend.db.listCollections();
      for (const collection of collections) {
        results.push(this.toGlobalCollection(collection, backend));
      }
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Creates a collection in the primary backend.
   */
  async createCollection(name: string): Promise<Collection> {
    const backend = this.requirePrimaryBackend();
    const created = await backend.db.createCollection(name);
    return this.toGlobalCollection(created, backend);
  }

  /**
   * Updates a collection in its owning backend.
   */
  async updateCollection(
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string
  ): Promise<Collection> {
    const { backend, localId } = this.resolveCollection(id);
    const updated = await backend.db.updateCollection(
      localId,
      name,
      variables,
      headers,
      preRequestScript,
      postRequestScript
    );
    return this.toGlobalCollection(updated, backend);
  }

  /**
   * Deletes a collection from its owning backend.
   */
  async deleteCollection(id: number): Promise<void> {
    const { backend, localId } = this.resolveCollection(id);
    await backend.db.deleteCollection(localId);
  }

  /**
   * Lists environments from the primary backend only.
   */
  async listEnvironments(): Promise<Environment[]> {
    const backend = this.requirePrimaryBackend();
    const environments = await backend.db.listEnvironments();
    return environments.map((environment) => this.toGlobalEnvironment(environment, backend.slot));
  }

  /**
   * Creates an environment in the primary backend.
   */
  async createEnvironment(name: string): Promise<Environment> {
    const backend = this.requirePrimaryBackend();
    const created = await backend.db.createEnvironment(name);
    return this.toGlobalEnvironment(created, backend.slot);
  }

  /**
   * Updates an environment in the primary backend.
   */
  async updateEnvironment(id: number, name: string, variables: Variable[]): Promise<Environment> {
    const backend = this.requirePrimaryBackend();
    const { localId } = decodeGlobalId(id);
    const updated = await backend.db.updateEnvironment(localId, name, variables);
    return this.toGlobalEnvironment(updated, backend.slot);
  }

  /**
   * Deletes an environment from the primary backend.
   */
  async deleteEnvironment(id: number): Promise<void> {
    const backend = this.requirePrimaryBackend();
    const { localId } = decodeGlobalId(id);
    await backend.db.deleteEnvironment(localId);
  }

  /**
   * Lists requests for a collection, rewriting ids to the global namespace.
   */
  async listRequests(collectionId: number): Promise<SavedRequest[]> {
    const { backend, localId } = this.resolveCollection(collectionId);
    const requests = await backend.db.listRequests(localId);
    return requests.map((request) => this.toGlobalRequest(request, backend));
  }

  /**
   * Saves a request in the backend that owns the target collection.
   */
  async saveRequest(input: SaveRequestInput): Promise<SavedRequest> {
    const { backend, localId: localCollectionId } = this.resolveCollection(input.collection_id);
    const localRequestId = input.id != null ? decodeGlobalId(input.id).localId : undefined;

    const saved = await backend.db.saveRequest({
      ...input,
      id: localRequestId,
      collection_id: localCollectionId
    });
    return this.toGlobalRequest(saved, backend);
  }

  /**
   * Deletes a request from its owning backend.
   */
  async deleteRequest(id: number): Promise<void> {
    const { slot, localId } = decodeGlobalId(id);
    const backend = this.requireBackend(slot);
    await backend.db.deleteRequest(localId);
  }

  /**
   * Exports collection data from its owning backend.
   */
  async exportCollectionData(id: number): Promise<CollectionExport> {
    const { backend, localId } = this.resolveCollection(id);
    return backend.db.exportCollectionData(localId);
  }

  /**
   * Imports a collection into the primary backend.
   */
  async importCollectionData(data: unknown): Promise<Collection> {
    const backend = this.requirePrimaryBackend();
    const imported = await backend.db.importCollectionData(data);
    return this.toGlobalCollection(imported, backend);
  }

  /**
   * Reads a setting from the primary backend.
   */
  async getSetting(key: string): Promise<string | undefined> {
    const backend = this.requirePrimaryBackend();
    return backend.db.getSetting(key);
  }

  /**
   * Persists a setting in the primary backend.
   */
  async setSetting(key: string, value: string): Promise<void> {
    const backend = this.requirePrimaryBackend();
    await backend.db.setSetting(key, value);
  }

  /**
   * Copies a collection and its requests to another backend, then deletes the source copy.
   *
   * @param globalCollectionId - Global id of the collection to move.
   * @param targetConnectionId - Connection id of the destination backend.
   * @returns The collection in its new backend with a new global id.
   */
  async moveCollection(
    globalCollectionId: number,
    targetConnectionId: string
  ): Promise<Collection> {
    const { backend: sourceBackend, localId: sourceLocalId } =
      this.resolveCollection(globalCollectionId);
    const targetBackend = this.requireBackendByConnectionId(targetConnectionId);

    if (sourceBackend.connectionId === targetBackend.connectionId) {
      const collections = await sourceBackend.db.listCollections();
      const existing = collections.find((collection) => collection.id === sourceLocalId);
      if (!existing) {
        throw new Error(`Collection not found: ${globalCollectionId}`);
      }
      return this.toGlobalCollection(existing, sourceBackend);
    }

    const collections = await sourceBackend.db.listCollections();
    const collection = collections.find((item) => item.id === sourceLocalId);
    if (!collection) {
      throw new Error(`Collection not found: ${globalCollectionId}`);
    }

    const requests = await sourceBackend.db.listRequests(sourceLocalId);

    const created = await targetBackend.db.createCollection(collection.name);
    const updated = await targetBackend.db.updateCollection(
      created.id,
      collection.name,
      collection.variables,
      collection.headers,
      collection.pre_request_script,
      collection.post_request_script
    );

    const sortedRequests = [...requests].sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    );

    for (const request of sortedRequests) {
      await targetBackend.db.saveRequest({
        collection_id: updated.id,
        name: request.name,
        method: request.method,
        url: request.url,
        headers: request.headers,
        params: request.params,
        body: request.body,
        body_type: request.body_type,
        pre_request_script: request.pre_request_script,
        post_request_script: request.post_request_script,
        comment: request.comment
      });
    }

    await sourceBackend.db.deleteCollection(sourceLocalId);
    return this.toGlobalCollection(updated, targetBackend);
  }

  /**
   * Creates and mounts every configured connection, skipping failures gracefully.
   *
   * @param connections - All configured connections.
   * @param slots - Connection id to slot map.
   * @param userDataPath - Electron userData path for SQLite storage.
   */
  static async create(
    primaryConnectionId: string,
    connections: DatabaseConnection[],
    slots: Record<string, number>,
    userDataPath: string
  ): Promise<RoutingDatabase> {
    const router = new RoutingDatabase(primaryConnectionId);

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

    return router;
  }

  private getPrimaryBackend(): MountedBackend | undefined {
    for (const backend of this.backends.values()) {
      if (backend.connectionId === this.primaryConnectionId) {
        return backend;
      }
    }
    return undefined;
  }

  private getEffectivePrimaryBackend(): MountedBackend | undefined {
    const primary = this.getPrimaryBackend();
    if (primary) return primary;

    for (const backend of this.backends.values()) {
      if (backend.connectionType === 'sqlite') {
        return backend;
      }
    }

    return this.backends.values().next().value;
  }

  private requirePrimaryBackend(): MountedBackend {
    const backend = this.getEffectivePrimaryBackend();
    if (!backend) {
      throw new Error('Primary database is unavailable.');
    }
    return backend;
  }

  private requireBackend(slot: number): MountedBackend {
    const backend = this.backends.get(slot);
    if (!backend) {
      throw new Error(`Database backend for slot ${slot} is unavailable.`);
    }
    return backend;
  }

  private requireBackendByConnectionId(connectionId: string): MountedBackend {
    for (const backend of this.backends.values()) {
      if (backend.connectionId === connectionId) {
        return backend;
      }
    }
    throw new Error(`Database connection "${connectionId}" is unavailable.`);
  }

  private resolveCollection(globalCollectionId: number): {
    backend: MountedBackend;
    localId: number;
  } {
    const { slot, localId } = decodeGlobalId(globalCollectionId);
    return { backend: this.requireBackend(slot), localId };
  }

  private toGlobalCollection(collection: Collection, backend: MountedBackend): Collection {
    return {
      ...collection,
      id: encodeGlobalId(backend.slot, collection.id),
      connectionId: backend.connectionId
    };
  }

  private toGlobalRequest(request: SavedRequest, backend: MountedBackend): SavedRequest {
    return {
      ...request,
      id: encodeGlobalId(backend.slot, request.id),
      collection_id: encodeGlobalId(backend.slot, request.collection_id)
    };
  }

  private toGlobalEnvironment(environment: Environment, slot: number): Environment {
    return {
      ...environment,
      id: encodeGlobalId(slot, environment.id)
    };
  }
}
