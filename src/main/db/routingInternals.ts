import type { CollectionRegistryEntry, LocalRegistry } from '#/main/db/LocalRegistry';
import type { IDatabase } from '#/main/db/IDatabase';
import type { Collection, DatabaseProvider } from '#/shared/types';

/**
 * A database provider mounted at a fixed slot for global id namespacing.
 */
export interface MountedBackend {
  slot: number;
  connectionId: string;
  connectionName: string;
  connectionType: DatabaseProvider;
  db: IDatabase;
}

/**
 * Internal routing context shared by move and migration helpers.
 *
 * Exposes only what those helpers need from RoutingDatabase without
 * widening the public API or duplicating backend-resolution logic.
 */
export interface RoutingInternals {
  readonly registry: LocalRegistry;
  getBackend(connectionId: string): MountedBackend | undefined;
  listBackends(): MountedBackend[];
  requireBackendByConnectionId(connectionId: string): MountedBackend;
  requireDefaultDataBackend(): MountedBackend;
  resolveDefaultDataBackend(): MountedBackend;
  requireEntry(id: number): CollectionRegistryEntry;
  buildCollection(entry: CollectionRegistryEntry, record: Collection | undefined): Collection;
}
