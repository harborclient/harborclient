import { describe, expect, it, vi } from 'vitest';
import { MoveCoordinator } from './CollectionMover';
import type { CollectionRegistryEntry, LocalDatabase } from './LocalDatabase';
import type { MountedBackend, RoutingInternals } from './routingInternals';
import type { Collection, CollectionDocument, Folder } from '#/shared/types';
import { defaultAuth } from '#/shared/auth';

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
    updateRegistryEntry: vi.fn((_id, patch) => ({ ...options.entry, ...patch })),
    addRegistryEntry: vi.fn((patch) => ({
      id: 200,
      created_at: '2026-01-01T00:00:00.000Z',
      ...patch
    }))
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
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
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
        listDocuments: vi.fn().mockResolvedValue([]),
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
        saveRequest: vi.fn(),
        saveDocument: vi.fn()
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

describe('MoveCoordinator document copy', () => {
  it('copies root and folder documents with remapped folder ids and preserved uuids on move', async () => {
    const record: Collection = {
      id: 1,
      uuid: '550e8400-e29b-41d4-a716-446655440000',
      name: 'API Docs',
      variables: [],
      headers: [],
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      created_at: '2026-01-01T00:00:00.000Z'
    };

    const sourceFolder: Folder = {
      id: 50,
      collection_id: 10,
      uuid: 'folder-uuid',
      name: 'Docs',
      variables: [],
      headers: [],
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z'
    };

    const sourceDocuments: CollectionDocument[] = [
      {
        id: 1,
        collection_id: 10,
        folder_id: null,
        uuid: 'doc-root-uuid',
        name: 'README.md',
        content: '# Root notes',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 2,
        collection_id: 10,
        folder_id: 50,
        uuid: 'doc-folder-uuid',
        name: 'notes.md',
        content: '# Folder notes',
        sort_order: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z'
      }
    ];

    const targetCreate = vi.fn().mockResolvedValue({ ...record, id: 2, name: 'API Docs' });
    const targetUpdate = vi.fn().mockResolvedValue({ ...record, id: 2, name: 'API Docs' });
    const targetCreateFolder = vi
      .fn()
      .mockResolvedValue({ ...sourceFolder, id: 200, collection_id: 2 });
    const targetSaveDocument = vi.fn().mockImplementation(async (input) => ({
      id: 300,
      collection_id: input.collection_id,
      folder_id: input.folder_id ?? null,
      uuid: input.uuid ?? 'generated',
      name: input.name,
      content: input.content ?? '',
      sort_order: input.sort_order ?? 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z'
    }));

    const sourceBackend: MountedBackend = {
      slot: 0,
      connectionId: 'conn-a',
      connectionName: 'SQLite A',
      connectionType: 'sqlite',
      db: {
        listCollections: vi.fn().mockResolvedValue([{ ...record, id: 10 }]),
        listRequests: vi.fn().mockResolvedValue([]),
        listFolders: vi.fn().mockResolvedValue([sourceFolder]),
        listDocuments: vi.fn().mockResolvedValue(sourceDocuments),
        deleteCollection: vi.fn()
      } as unknown as MountedBackend['db']
    };

    const targetBackend: MountedBackend = {
      slot: 1,
      connectionId: 'conn-b',
      connectionName: 'SQLite B',
      connectionType: 'sqlite',
      db: {
        createCollection: targetCreate,
        updateCollection: targetUpdate,
        createFolder: targetCreateFolder,
        updateFolder: vi.fn(),
        reorderFolders: vi.fn(),
        saveRequest: vi.fn(),
        saveDocument: targetSaveDocument
      } as unknown as MountedBackend['db']
    };

    const entry: CollectionRegistryEntry = {
      id: 100,
      name: 'API Docs',
      collectionUuid: '550e8400-e29b-41d4-a716-446655440000',
      connectionId: 'conn-a',
      providerCollectionId: 10,
      created_at: '2026-01-01T00:00:00.000Z'
    };

    const mover = new MoveCoordinator(
      createInternals({
        sourceBackend,
        targetBackend,
        entry,
        record
      })
    );

    await mover.moveCollection(100, 'conn-b');

    expect(targetSaveDocument).toHaveBeenCalledTimes(2);
    expect(targetSaveDocument).toHaveBeenNthCalledWith(1, {
      collection_id: 2,
      folder_id: null,
      name: 'README.md',
      content: '# Root notes',
      uuid: 'doc-root-uuid',
      sort_order: 0
    });
    expect(targetSaveDocument).toHaveBeenNthCalledWith(2, {
      collection_id: 2,
      folder_id: 200,
      name: 'notes.md',
      content: '# Folder notes',
      uuid: 'doc-folder-uuid',
      sort_order: 1
    });
  });

  it('copies documents when duplicating a collection', async () => {
    const record: Collection = {
      id: 1,
      uuid: '550e8400-e29b-41d4-a716-446655440000',
      name: 'API Docs',
      variables: [],
      headers: [],
      auth: defaultAuth(),
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      created_at: '2026-01-01T00:00:00.000Z'
    };

    const sourceDocuments: CollectionDocument[] = [
      {
        id: 1,
        collection_id: 10,
        folder_id: null,
        uuid: 'doc-root-uuid',
        name: 'README.md',
        content: '# Root notes',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z'
      }
    ];

    const targetCreate = vi.fn().mockResolvedValue({ ...record, id: 2, name: 'API Docs (copy)' });
    const targetUpdate = vi.fn().mockResolvedValue({ ...record, id: 2, name: 'API Docs (copy)' });
    const targetSaveDocument = vi.fn().mockResolvedValue({
      id: 300,
      collection_id: 2,
      folder_id: null,
      uuid: 'doc-root-uuid',
      name: 'README.md',
      content: '# Root notes',
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z'
    });

    const backend: MountedBackend = {
      slot: 0,
      connectionId: 'conn-a',
      connectionName: 'SQLite',
      connectionType: 'sqlite',
      db: {
        listCollections: vi.fn().mockResolvedValue([{ ...record, id: 10 }]),
        listRequests: vi.fn().mockResolvedValue([]),
        listFolders: vi.fn().mockResolvedValue([]),
        listDocuments: vi.fn().mockResolvedValue(sourceDocuments),
        createCollection: targetCreate,
        updateCollection: targetUpdate,
        createFolder: vi.fn(),
        reorderFolders: vi.fn(),
        saveRequest: vi.fn(),
        saveDocument: targetSaveDocument
      } as unknown as MountedBackend['db']
    };

    const entry: CollectionRegistryEntry = {
      id: 100,
      name: 'API Docs',
      collectionUuid: '550e8400-e29b-41d4-a716-446655440000',
      connectionId: 'conn-a',
      providerCollectionId: 10,
      created_at: '2026-01-01T00:00:00.000Z'
    };

    const mover = new MoveCoordinator(
      createInternals({
        sourceBackend: backend,
        targetBackend: backend,
        entry,
        record
      })
    );

    await mover.duplicateCollection(100);

    expect(targetSaveDocument).toHaveBeenCalledWith({
      collection_id: 2,
      folder_id: null,
      name: 'README.md',
      content: '# Root notes',
      uuid: 'doc-root-uuid',
      sort_order: 0
    });
  });
});
