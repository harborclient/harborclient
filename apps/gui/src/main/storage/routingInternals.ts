import type { CollectionRegistryEntry, LocalDatabase } from './LocalDatabase';
import type { IStorage } from './IStorage';
import type { Collection, CollectionProviderKind } from '#/shared/types';

/**
 * Minimal descriptor for a mounted collection provider.
 */
export interface ProviderDescriptor {
  id: string;
  name: string;
  type: CollectionProviderKind;
}

/**
 * A collection provider mounted at a fixed slot for global id namespacing.
 */
export interface MountedBackend {
  slot: number;
  connectionId: string;
  connectionName: string;
  connectionType: CollectionProviderKind;
  db: IStorage;
  /**
   * Team Hub base URL when {@link connectionType} is `team-hub`.
   */
  teamHubBaseUrl?: string;
}

/**
 * Internal routing context shared by move and migration helpers.
 *
 * Exposes only what those helpers need from RoutingStorage without
 * widening the public API or duplicating backend-resolution logic.
 */
export interface RoutingInternals {
  readonly database: LocalDatabase;
  getBackend(connectionId: string): MountedBackend | undefined;
  listBackends(): MountedBackend[];
  requireBackendByConnectionId(connectionId: string): MountedBackend;
  requireDefaultDataBackend(): MountedBackend;
  resolveDefaultDataBackend(): MountedBackend;
  requireEntry(id: number): CollectionRegistryEntry;
  buildCollection(entry: CollectionRegistryEntry, record: Collection | undefined): Collection;
  resolveCollectionServerId(connectionId: string, providerCollectionId: number): string | undefined;
  addDetachedTeamHubCollection(hubId: string, serverCollectionId: string): void;
}
