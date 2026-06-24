import { describe, expect, it, vi } from 'vitest';
import { MoveCoordinator } from '#/main/storage/CollectionMover';
import type { CollectionRegistryEntry, LocalDatabase } from '#/main/storage/LocalDatabase';
import type { MountedBackend, RoutingInternals } from '#/main/storage/routingInternals';
import type { Collection } from '#/shared/types';

/**
 * Builds a minimal routing internals mock for move coordinator tests.
 *
 * @param options - Backend and registry behavior overrides.
 */
function createInternals(options: {
  sourceBackend: MountedBackend;
  targetBackend: MountedBackend;
  entry: CollectionRegistryEntry;
  record: Collection;
  folders?: [];
  requests?: [];
  resolveCollectionServerId?: (
    connectionId: string,
    providerCollectionId: number
  ) => string | undefined;
  addDetachedTeamHubCollection?: (hubId: string, serverCollectionId: string) => void;
}): RoutingInternals {
  const registry = {
    getSetting: vi.fn(() => undefined),
    setSetting: vi.fn(),
    updateRegistryEntry: vi.fn((_id, patch) => ({ ...options.entry, ...patch }))
  } as unknown as LocalDatabase;

  return {
    database: registry,
    getBackend: (connectionId: string) => {
      if (connectionId === options.sourceBackend.connectionId) return options.sourceBackend;
      if (connectionId === options.targetBackend.connectionId) return options.targetBackend;
      return undefined;
    },
    listBackends: () => [options.sourceBackend, options.targetBackend],
    requireBackendByConnectionId: (connectionId: string) => {
      const backend =
        connectionId === options.sourceBackend.connectionId
          ? options.sourceBackend
          : options.targetBackend;
      if (!backend) throw new Error(`Missing backend ${connectionId}`);
      return backend;
    },
    requireDefaultDataBackend: () => options.targetBackend,
    resolveDefaultDataBackend: () => options.targetBackend,
    requireEntry: () => options.entry,
    buildCollection: (entry, record) => ({ ...(record ?? options.record), id: entry.id }),
    resolveCollectionServerId:
      options.resolveCollectionServerId ?? (() => '550e8400-e29b-41d4-a716-446655440000'),
    addDetachedTeamHubCollection: options.addDetachedTeamHubCollection ?? vi.fn()
  };
}

describe('MoveCoordinator team hub source', () => {
  it('leaves the server copy intact and records a detached id when moving off a hub', async () => {
    const record: Collection = {
      id: 1,
      uuid: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Team API',
      variables: [],
      headers: [],
      auth: {
        type: 'none',
        basic: { username: '', password: '' },
        bearer: { token: '' }
      },
      pre_request_script: '',
      post_request_script: '',
      created_at: '2026-01-01T00:00:00.000Z'
    };

    const sourceDelete = vi.fn();
    const targetCreate = vi.fn().mockResolvedValue({ ...record, id: 2, name: 'Team API' });
    const targetUpdate = vi.fn().mockResolvedValue({ ...record, id: 2, name: 'Team API' });
    const addDetached = vi.fn();

    const sourceBackend: MountedBackend = {
      slot: 1,
      connectionId: 'hub-a',
      connectionName: 'Hub A',
      connectionType: 'team-hub',
      db: {
        listCollections: vi.fn().mockResolvedValue([{ ...record, id: 10 }]),
        listRequests: vi.fn().mockResolvedValue([]),
        listFolders: vi.fn().mockResolvedValue([]),
        deleteCollection: sourceDelete
      } as unknown as MountedBackend['db']
    };

    const targetBackend: MountedBackend = {
      slot: 0,
      connectionId: 'conn-a',
      connectionName: 'SQLite',
      connectionType: 'sqlite',
      db: {
        createCollection: targetCreate,
        updateCollection: targetUpdate,
        createFolder: vi.fn(),
        reorderFolders: vi.fn(),
        saveRequest: vi.fn()
      } as unknown as MountedBackend['db']
    };

    const entry: CollectionRegistryEntry = {
      id: 100,
      name: 'Team API',
      collectionUuid: '550e8400-e29b-41d4-a716-446655440000',
      connectionId: 'hub-a',
      providerCollectionId: 10,
      created_at: '2026-01-01T00:00:00.000Z'
    };

    const mover = new MoveCoordinator(
      createInternals({
        sourceBackend,
        targetBackend,
        entry,
        record,
        addDetachedTeamHubCollection: addDetached
      })
    );

    await mover.moveCollection(100, 'conn-a');

    expect(sourceDelete).not.toHaveBeenCalled();
    expect(addDetached).toHaveBeenCalledWith('hub-a', '550e8400-e29b-41d4-a716-446655440000');
  });
});
