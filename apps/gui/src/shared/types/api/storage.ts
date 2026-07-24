import type {
  DiscoveredCollection,
  RegisterDiscoveredCollectionsResult,
  StorageConnection
} from '#/shared/types/storage';

/**
 * IPC methods for storage.
 */
export interface ApiStorage {
  /**
   * Lists all configured database connections.
   */
  listStorageConnections: () => Promise<StorageConnection[]>;
  /**
   * Creates or updates a database connection.
   *
   * @param conn - Connection to persist; empty id inserts a new connection.
   * @returns Updated list of all connections.
   */
  saveStorageConnection: (conn: StorageConnection) => Promise<StorageConnection[]>;
  /**
   * Deletes a database connection by id.
   *
   * @param id - Connection id to remove.
   * @returns Updated list of all connections.
   */
  deleteStorageConnection: (id: string) => Promise<StorageConnection[]>;
  /**
   * Re-reads collection data from a single provider (database or team hub).
   *
   * @param connectionId - Provider connection id to sync.
   */
  syncProvider: (connectionId: string) => Promise<void>;
  /**
   * Lists collections on a mounted provider that are not yet in the sidebar registry.
   *
   * @param connectionId - Storage connection id to scan.
   */
  listUnregisteredCollections: (connectionId: string) => Promise<DiscoveredCollection[]>;
  /**
   * Registers selected provider collections in the sidebar registry.
   *
   * @param connectionId - Storage connection id that owns the collections.
   * @param providerCollectionIds - Provider-local collection ids to add.
   */
  registerDiscoveredCollections: (
    connectionId: string,
    providerCollectionIds: number[]
  ) => Promise<RegisterDiscoveredCollectionsResult>;
  /**
   * Records that the user skipped collection discovery for a storage connection.
   *
   * @param connectionId - Storage connection id to mark.
   */
  markCollectionDiscoverySkipped: (connectionId: string) => Promise<StorageConnection[]>;
  /**
   * Subscribes to storage connection list changes (save or delete).
   *
   * @param callback - Handler invoked when connections change.
   * @returns Unsubscribe function.
   */
  onStorageConnectionsChanged: (callback: () => void) => () => void;
}
