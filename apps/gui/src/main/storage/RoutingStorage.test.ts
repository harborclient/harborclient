import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, expect, it, vi } from 'vitest';
import type { StorageConnection, SqliteSettings } from '#/shared/types';
import { defaultAuth } from '#/shared/auth';
import { decodeGlobalId, ID_OFFSET } from './idNamespace';
import { LocalDatabase } from './LocalDatabase';
import { RoutingStorage } from './RoutingStorage';
import { GitStorage } from './GitStorage';
import { SqliteStorage } from './SqliteStorage';
import { TeamHubStorage } from './TeamHubStorage';
import { TeamHubIdMap } from './TeamHubIdMap';
import { TeamHubFolderSettings } from './TeamHubFolderSettings';
import type { SessionResponse, TeamHubClient } from '@harborclient/team-hub-api';
import { TeamHubClientError } from '@harborclient/team-hub-api';
import { detachedSettingKey, detachedSnippetSettingKey } from './teamHubDetached';
import { teamHubIdMapPath } from './createTeamHubStorage';
import { baseDocumentInput, baseRequestInput } from '#/test/istorageContract';
import { describeSqlite } from '#/test/nativeModules';

const BASE_SQLITE_SETTINGS: SqliteSettings = {
  dbFilename: 'harborclient.db',
  legacyDbFilename: 'harbor-client.db',
  legacyUserDataDir: 'harbor-client'
};

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'appData') return join(tmpdir(), 'harborclient-routing-appdata');
      return tmpdir();
    })
  }
}));

const CONN_A: StorageConnection = {
  id: 'conn-a',
  name: 'SQLite A',
  type: 'sqlite',
  settings: { ...BASE_SQLITE_SETTINGS, dbFilename: 'a.db' }
};

const CONN_B: StorageConnection = {
  id: 'conn-b',
  name: 'SQLite B',
  type: 'sqlite',
  settings: { ...BASE_SQLITE_SETTINGS, dbFilename: 'b.db' }
};

const HUB_A = {
  id: 'hub-a',
  name: 'First',
  type: 'team-hub' as const
};

const SERVER_COLLECTION_RECORD = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Team API',
  variables: [],
  headers: [],
  auth: {
    type: 'none' as const,
    basic: { username: '', password: '' },
    bearer: { token: '' }
  },
  preRequestScript: '',
  postRequestScript: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  deletionLocked: false
};

const cleanups: Array<() => void | Promise<void>> = [];

/**
 * Default user-token session mock for team hub client tests.
 *
 * @param managementApi - When true, simulates an admin-token connection.
 */
function userTeamHubSessionMock(managementApi = false): SessionResponse {
  return {
    user: {
      id: 'user-1',
      name: 'User',
      role: managementApi ? 'admin' : 'user'
    },
    token: { id: 'token-1', prefix: 'hbk_test' },
    capabilities: {
      dataApi: !managementApi,
      managementApi,
      llm: false
    }
  };
}

/**
 * Merges default team hub client mocks with test-specific overrides.
 *
 * @param client - Partial TeamHubClient mock.
 */
function withDefaultTeamHubClient(client: Partial<TeamHubClient>): Partial<TeamHubClient> {
  return {
    getSession: vi.fn().mockResolvedValue(userTeamHubSessionMock(false)),
    listSnippets: vi.fn().mockResolvedValue([]),
    ...client
  };
}

/**
 * Builds a routing database fixture with mounted backends for tests.
 *
 * @param options - Optional flags such as whether to mount a second backend.
 * @returns Test routing database, database, backends, and temp root directory.
 */
async function createRoutingFixture(options?: { mountB?: boolean }): Promise<{
  router: RoutingStorage;
  database: LocalDatabase;
  backendA: SqliteStorage;
  backendB: SqliteStorage;
  rootDir: string;
}> {
  const rootDir = mkdtempSync(join(tmpdir(), 'harborclient-routing-'));
  const database = new LocalDatabase(rootDir);
  await database.init();

  const backendADir = join(rootDir, 'backend-a');
  const backendBDir = join(rootDir, 'backend-b');
  mkdirSync(backendADir, { recursive: true });
  mkdirSync(backendBDir, { recursive: true });

  const backendA = new SqliteStorage(backendADir, CONN_A.settings as SqliteSettings);
  const backendB = new SqliteStorage(backendBDir, CONN_B.settings as SqliteSettings);
  await backendA.init();
  await backendB.init();

  const router = new RoutingStorage(database, CONN_A.id, rootDir);
  router.mount(0, CONN_A, backendA);
  if (options?.mountB !== false) {
    router.mount(1, CONN_B, backendB);
  }

  cleanups.push(async () => {
    await router.close();
    rmSync(rootDir, { recursive: true, force: true });
  });

  return { router, database, backendA, backendB, rootDir };
}

/**
 * Builds a TeamHubStorage backed by a mock client and temp id map for routing tests.
 *
 * @param client - Partial TeamHubClient mock.
 * @returns Team hub database adapter.
 */
function createTeamHubStorage(client: Partial<TeamHubClient>): TeamHubStorage {
  const dir = mkdtempSync(join(tmpdir(), 'harborclient-routing-hub-'));
  const dbPath = join(dir, 'team-hub-test.db');
  const idMap = new TeamHubIdMap(dbPath);
  idMap.init();
  const folderSettings = new TeamHubFolderSettings(dbPath);
  folderSettings.init();
  cleanups.push(() => {
    idMap.close();
    folderSettings.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return new TeamHubStorage(client as TeamHubClient, idMap, folderSettings);
}

/**
 * Builds a routing database fixture with SQLite and a mounted team hub.
 *
 * @param client - Partial TeamHubClient mock for the hub backend.
 * @returns Test routing database, database, hub database, and temp root directory.
 */
async function createRoutingFixtureWithHub(client: Partial<TeamHubClient>): Promise<{
  router: RoutingStorage;
  database: LocalDatabase;
  hubDb: TeamHubStorage;
  rootDir: string;
}> {
  const rootDir = mkdtempSync(join(tmpdir(), 'harborclient-routing-'));
  const database = new LocalDatabase(rootDir);
  await database.init();

  const backendADir = join(rootDir, 'backend-a');
  mkdirSync(backendADir, { recursive: true });

  const backendA = new SqliteStorage(backendADir, CONN_A.settings as SqliteSettings);
  await backendA.init();

  const hubDb = createTeamHubStorage(withDefaultTeamHubClient(client));

  const router = new RoutingStorage(database, CONN_A.id, rootDir);
  router.mount(0, CONN_A, backendA);
  router.mount(1, HUB_A, hubDb, 'http://127.0.0.1:8788');

  cleanups.push(async () => {
    await router.close();
    rmSync(rootDir, { recursive: true, force: true });
  });

  return { router, database, hubDb, rootDir };
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describeSqlite('RoutingStorage collections', () => {
  it('createCollection registers in registry and provider with stable global id', async () => {
    const { router, database } = await createRoutingFixture();
    const created = await router.createCollection('My API');

    expect(created.id).toEqual(expect.any(Number));
    expect(created.name).toBe('My API');
    expect(created.connectionId).toBe(CONN_A.id);

    const entry = database.getRegistryEntry(created.id);
    expect(entry?.connectionId).toBe(CONN_A.id);
    expect(entry?.providerCollectionId).toEqual(expect.any(Number));

    const listed = await router.listCollections();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
    expect(listed[0]?.name).toBe('My API');
  });

  it('listCollections tolerates an unmounted provider', async () => {
    const { router, database } = await createRoutingFixture({ mountB: false });
    database.addRegistryEntry({
      name: 'Orphan',
      connectionId: 'missing-conn',
      providerCollectionId: 1
    });

    const listed = await router.listCollections();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe('Orphan');
    expect(listed[0]?.variables).toEqual([]);
    expect(router.consumeCollectionListWarnings()).toEqual([
      'Could not load collection data: database connection "missing-conn" is unavailable.'
    ]);
  });

  it('listCollections records warnings when a provider read fails', async () => {
    const { router, backendA } = await createRoutingFixture();
    await router.createCollection('Healthy');
    await router.createCollectionInProvider('Remote', CONN_B.id);

    vi.spyOn(backendA, 'listCollections').mockRejectedValueOnce(new Error('Connection refused'));

    const listed = await router.listCollections();
    expect(listed.map((c) => c.name).sort()).toEqual(['Healthy', 'Remote']);
    expect(router.consumeCollectionListWarnings()).toEqual([
      'Could not load collections from "SQLite A": Connection refused'
    ]);
  });

  it('reorderCollections updates listCollections order', async () => {
    const { router } = await createRoutingFixture();
    const first = await router.createCollection('First');
    const second = await router.createCollection('Second');
    const third = await router.createCollection('Third');

    expect((await router.listCollections()).map((collection) => collection.name)).toEqual([
      'First',
      'Second',
      'Third'
    ]);

    await router.reorderCollections([third.id, first.id, second.id]);
    expect((await router.listCollections()).map((collection) => collection.name)).toEqual([
      'Third',
      'First',
      'Second'
    ]);
  });

  it('createCollection deletes provider row when registry registration fails', async () => {
    const { router, database, backendA } = await createRoutingFixture();
    vi.spyOn(database, 'addRegistryEntry').mockImplementationOnce(() => {
      throw new Error('Registry write failed');
    });

    await expect(router.createCollection('Orphan')).rejects.toThrow('Registry write failed');
    expect(await backendA.listCollections()).toEqual([]);
    expect(database.listRegistry()).toEqual([]);
  });

  it('registerSharedCollection records warnings when provider read fails', async () => {
    const { router, backendA, rootDir } = await createRoutingFixture();
    vi.spyOn(backendA, 'listCollections').mockRejectedValueOnce(new Error('Connection refused'));

    const collection = await router.registerSharedCollection(CONN_A, 0, rootDir, {
      name: 'Shared API',
      providerCollectionId: 1
    });

    expect(collection.name).toBe('Shared API');
    expect(collection.variables).toEqual([]);
    expect(router.consumeCollectionListWarnings()).toEqual([
      'Could not load collections from "SQLite A": Connection refused'
    ]);
  });

  it('importCollectionData deletes provider row when registry registration fails', async () => {
    const { router, database, backendA } = await createRoutingFixture();
    vi.spyOn(database, 'addRegistryEntry').mockImplementationOnce(() => {
      throw new Error('Registry write failed');
    });

    const payload = {
      harborclientVersion: 1 as const,
      harborclientExport: 'collection' as const,
      name: 'Imported API',
      variables: [],
      headers: [],
      pre_request_script: '',
      post_request_script: '',
      pre_request_scripts: [],
      post_request_scripts: [],
      folders: [],
      requests: []
    };

    await expect(router.importCollectionData(payload)).rejects.toThrow('Registry write failed');
    expect(await backendA.listCollections()).toEqual([]);
    expect(database.listRegistry()).toEqual([]);
  });
});

describeSqlite('RoutingStorage global ids', () => {
  it('encodes request and folder ids by backend slot', async () => {
    const { router } = await createRoutingFixture();
    const collection = await router.createCollection('Global IDs');
    const folder = await router.createFolder(collection.id, 'Auth');
    const request = await router.saveRequest(
      baseRequestInput(collection.id, { name: 'Login', folder_id: folder.id })
    );

    expect(decodeGlobalId(folder.id)).toEqual({ slot: 0, localId: expect.any(Number) });
    expect(decodeGlobalId(request.id).slot).toBe(0);
    expect(request.folder_id).toBe(folder.id);
    expect(request.collection_id).toBe(collection.id);

    await router.moveCollection(collection.id, CONN_B.id);
    const slotOneFolder = await router.createFolder(collection.id, 'API');
    expect(decodeGlobalId(slotOneFolder.id)).toEqual({ slot: 1, localId: expect.any(Number) });
    expect(slotOneFolder.id).toBeGreaterThanOrEqual(ID_OFFSET);
  });

  it('routes deleteRequest and deleteFolder by slot', async () => {
    const { router } = await createRoutingFixture();
    const collection = await router.createCollection('Deletes');
    const folder = await router.createFolder(collection.id, 'Temp');
    const request = await router.saveRequest(
      baseRequestInput(collection.id, { folder_id: folder.id })
    );

    await router.deleteRequest(request.id);
    expect(await router.listRequests(collection.id)).toEqual([]);

    await router.deleteFolder(folder.id);
    expect(await router.listFolders(collection.id)).toEqual([]);
  });

  it('saveRequest decodes global folder and request ids before delegating', async () => {
    const { router } = await createRoutingFixture();
    const collection = await router.createCollection('Decode');
    const folder = await router.createFolder(collection.id, 'API');
    const created = await router.saveRequest(
      baseRequestInput(collection.id, { name: 'Original', folder_id: folder.id })
    );

    const updated = await router.saveRequest({
      ...baseRequestInput(collection.id),
      id: created.id,
      name: 'Updated',
      folder_id: folder.id
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe('Updated');
    expect(updated.folder_id).toBe(folder.id);
  });

  it('rejects saveRequest when request or folder id belongs to another backend slot', async () => {
    const { router } = await createRoutingFixture();
    const collectionA = await router.createCollection('Slot A');
    const folderA = await router.createFolder(collectionA.id, 'API');
    const requestA = await router.saveRequest(
      baseRequestInput(collectionA.id, { name: 'On A', folder_id: folderA.id })
    );

    const collectionB = await router.createCollection('Slot B');
    await router.moveCollection(collectionB.id, CONN_B.id);
    const folderB = await router.createFolder(collectionB.id, 'Remote');

    const wrongSlotRequestId = requestA.id + ID_OFFSET;
    const wrongSlotFolderId = folderB.id;

    await expect(
      router.saveRequest({
        ...baseRequestInput(collectionA.id),
        id: wrongSlotRequestId,
        name: 'Cross-slot update'
      })
    ).rejects.toThrow(/does not belong to backend slot 0/);

    await expect(
      router.saveRequest({
        ...baseRequestInput(collectionA.id),
        name: 'Wrong folder',
        folder_id: wrongSlotFolderId
      })
    ).rejects.toThrow(/does not belong to backend slot 0/);
  });

  it('rejects reorderFolders and reorderRequests when ids belong to another backend slot', async () => {
    const { router } = await createRoutingFixture();
    const collectionA = await router.createCollection('Reorder A');
    const folderA = await router.createFolder(collectionA.id, 'One');
    const folderB = await router.createFolder(collectionA.id, 'Two');
    const request = await router.saveRequest(
      baseRequestInput(collectionA.id, { name: 'Req', folder_id: folderA.id })
    );

    const collectionRemote = await router.createCollection('Remote');
    await router.moveCollection(collectionRemote.id, CONN_B.id);
    const remoteFolder = await router.createFolder(collectionRemote.id, 'Remote');
    const remoteRequest = await router.saveRequest(
      baseRequestInput(collectionRemote.id, { name: 'Remote req', folder_id: remoteFolder.id })
    );

    await expect(
      router.reorderFolders(collectionA.id, [folderB.id, remoteFolder.id])
    ).rejects.toThrow(/does not belong to backend slot 0/);

    await expect(
      router.reorderRequests(collectionA.id, folderA.id, [request.id, remoteRequest.id])
    ).rejects.toThrow(/does not belong to backend slot 0/);

    await expect(
      router.reorderRequests(collectionA.id, remoteFolder.id, [request.id])
    ).rejects.toThrow(/does not belong to backend slot 0/);
  });
});

describeSqlite('RoutingStorage moveCollection', () => {
  it('copies collection data to another backend and updates registry', async () => {
    const { router, database, backendA, backendB } = await createRoutingFixture();
    const collection = await router.createCollection('Move Me');
    const folder = await router.createFolder(collection.id, 'Auth');
    await router.saveRequest(
      baseRequestInput(collection.id, { name: 'Login', folder_id: folder.id, method: 'POST' })
    );
    await router.saveRequest(baseRequestInput(collection.id, { name: 'Health' }));
    const rootDoc = await router.saveDocument(
      baseDocumentInput(collection.id, {
        name: 'README.md',
        content: '# Collection notes',
        uuid: 'doc-root-uuid'
      })
    );
    const folderDoc = await router.saveDocument(
      baseDocumentInput(collection.id, {
        name: 'notes.md',
        content: '# Folder notes',
        folder_id: folder.id,
        uuid: 'doc-folder-uuid'
      })
    );

    const globalId = collection.id;
    const moved = await router.moveCollection(globalId, CONN_B.id);

    expect(moved.id).toBe(globalId);
    expect(moved.connectionId).toBe(CONN_B.id);

    const entryAfter = database.getRegistryEntry(globalId)!;
    expect(entryAfter.connectionId).toBe(CONN_B.id);

    expect(await backendA.listCollections()).toEqual([]);
    const targetCollections = await backendB.listCollections();
    expect(targetCollections).toHaveLength(1);

    const movedRequests = await router.listRequests(globalId);
    expect(movedRequests.map((r) => r.name).sort()).toEqual(['Health', 'Login']);
    expect(movedRequests.every((r) => r.collection_id === globalId)).toBe(true);

    const movedFolders = await router.listFolders(globalId);
    expect(movedFolders.map((f) => f.name)).toEqual(['Auth']);

    const movedDocuments = await router.listDocuments(globalId);
    expect(movedDocuments.map((document) => document.name).sort()).toEqual([
      'README.md',
      'notes.md'
    ]);
    expect(movedDocuments.every((document) => document.collection_id === globalId)).toBe(true);

    const movedRootDoc = movedDocuments.find((document) => document.name === 'README.md');
    const movedFolderDoc = movedDocuments.find((document) => document.name === 'notes.md');
    expect(movedRootDoc?.uuid).toBe(rootDoc.uuid);
    expect(movedRootDoc?.content).toBe('# Collection notes');
    expect(movedRootDoc?.folder_id).toBeNull();
    expect(movedFolderDoc?.uuid).toBe(folderDoc.uuid);
    expect(movedFolderDoc?.content).toBe('# Folder notes');
    expect(movedFolderDoc?.folder_id).toBe(movedFolders[0]?.id);
  });

  it('returns existing collection when target connection is unchanged', async () => {
    const { router } = await createRoutingFixture();
    const collection = await router.createCollection('Same Connection');
    const moved = await router.moveCollection(collection.id, CONN_A.id);
    expect(moved.id).toBe(collection.id);
    expect(moved.connectionId).toBe(CONN_A.id);
  });
});

describeSqlite('RoutingStorage duplicateCollection', () => {
  it('copies collection settings, folders, and requests on the same backend', async () => {
    const { router, database, backendA } = await createRoutingFixture();
    const collection = await router.createCollection('Source API');
    await router.updateCollection(
      collection.id,
      'Source API',
      [{ key: 'baseUrl', value: 'https://api.example.com', defaultValue: '', share: true }],
      [{ key: 'Accept', value: 'application/json', enabled: true }],
      'console.log("pre")',
      'console.log("post")',
      {
        ...defaultAuth(),
        type: 'bearer',
        bearer: { token: 'source-token' }
      }
    );
    const folder = await router.createFolder(collection.id, 'Auth');
    await router.saveRequest(
      baseRequestInput(collection.id, { name: 'Login', folder_id: folder.id, method: 'POST' })
    );
    await router.saveRequest(baseRequestInput(collection.id, { name: 'Health' }));

    const sourceRequests = await router.listRequests(collection.id);
    const sourceLogin = sourceRequests.find((request) => request.name === 'Login');
    const sourceHealth = sourceRequests.find((request) => request.name === 'Health');

    const duplicated = await router.duplicateCollection(collection.id);

    expect(duplicated.id).not.toBe(collection.id);
    expect(duplicated.uuid).not.toBe(collection.uuid);
    expect(duplicated.uuid.trim()).not.toBe('');
    expect(duplicated.name).toBe('Source API (copy)');
    expect(duplicated.connectionId).toBe(CONN_A.id);
    expect(duplicated.variables).toEqual([
      { key: 'baseUrl', value: 'https://api.example.com', defaultValue: '', share: true }
    ]);
    expect(duplicated.headers).toEqual([
      { key: 'Accept', value: 'application/json', enabled: true }
    ]);
    expect(duplicated.pre_request_script).toBe('console.log("pre")');
    expect(duplicated.post_request_script).toBe('console.log("post")');
    expect(duplicated.auth).toEqual({
      ...defaultAuth(),
      type: 'bearer',
      bearer: { token: 'source-token' }
    });

    expect(database.listRegistry()).toHaveLength(2);

    const originalRequests = await router.listRequests(collection.id);
    expect(originalRequests.map((r) => r.name).sort()).toEqual(['Health', 'Login']);
    expect((await router.listFolders(collection.id)).map((f) => f.name)).toEqual(['Auth']);

    const copyRequests = await router.listRequests(duplicated.id);
    expect(copyRequests.map((r) => r.name).sort()).toEqual(['Health', 'Login']);
    expect(copyRequests.every((r) => r.collection_id === duplicated.id)).toBe(true);

    const copyFolders = await router.listFolders(duplicated.id);
    expect(copyFolders.map((f) => f.name)).toEqual(['Auth']);
    expect(copyFolders[0]?.id).not.toBe(folder.id);
    expect(copyFolders[0]?.uuid).not.toBe(folder.uuid);
    expect(copyFolders[0]?.uuid.trim()).not.toBe('');

    const copyLogin = copyRequests.find((request) => request.name === 'Login');
    const copyHealth = copyRequests.find((request) => request.name === 'Health');
    expect(copyLogin?.uuid).not.toBe(sourceLogin?.uuid);
    expect(copyHealth?.uuid).not.toBe(sourceHealth?.uuid);
    expect(copyLogin?.uuid.trim()).not.toBe('');
    expect(copyHealth?.uuid.trim()).not.toBe('');

    expect(await backendA.listCollections()).toHaveLength(2);
  });
});

describeSqlite('RoutingStorage snippets', () => {
  it('createSnippet registers in snippet registry and provider with stable global id', async () => {
    const { router, database } = await createRoutingFixture();
    const created = await router.createSnippet('Auth helper', 'hc.setToken();', 'pre-request');

    expect(created.id).toEqual(expect.any(Number));
    expect(created.name).toBe('Auth helper');
    expect(created.connectionId).toBe(CONN_A.id);
    expect(created.source).toBe('local');

    const entry = database.getSnippetRegistryEntry(created.id);
    expect(entry?.connectionId).toBe(CONN_A.id);
    expect(entry?.providerSnippetId).toEqual(expect.any(Number));

    const listed = await router.listSnippets();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
    expect(listed[0]?.code).toBe('hc.setToken();');
  });

  it('moveSnippet copies snippet data to another backend and keeps global id', async () => {
    const { router, database } = await createRoutingFixture({ mountB: true });
    const snippet = await router.createSnippet('Move me', 'console.log(1);', 'any');
    const globalId = snippet.id;

    const moved = await router.moveSnippet(globalId, CONN_B.id);

    expect(moved.id).toBe(globalId);
    expect(moved.connectionId).toBe(CONN_B.id);
    expect(moved.uuid).toBe(snippet.uuid);
    expect(moved.code).toBe('console.log(1);');

    const entry = database.getSnippetRegistryEntry(globalId);
    expect(entry?.connectionId).toBe(CONN_B.id);

    const listed = await router.listSnippets();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(globalId);
    expect(listed[0]?.connectionId).toBe(CONN_B.id);
  });

  it('moveSnippet throws a clear error when the target hub does not support snippets', async () => {
    const createSnippet = vi.fn().mockRejectedValue(
      new TeamHubClientError('Not Found', {
        status: 404,
        method: 'POST',
        path: '/snippets'
      })
    );
    const { router, database } = await createRoutingFixtureWithHub({ createSnippet });

    const snippet = await router.createSnippet('Move me', 'console.log(1);', 'any');

    await expect(router.moveSnippet(snippet.id, HUB_A.id)).rejects.toThrow(
      /does not respond to snippet storage routes/
    );

    const entry = database.getSnippetRegistryEntry(snippet.id);
    expect(entry?.connectionId).toBe(CONN_A.id);
  });

  it('moveSnippet throws a permission error when the hub rejects snippet create with 403', async () => {
    const createSnippet = vi.fn().mockRejectedValue(
      new TeamHubClientError('Forbidden', {
        status: 403,
        method: 'POST',
        path: '/snippets'
      })
    );
    const { router, database } = await createRoutingFixtureWithHub({ createSnippet });

    const snippet = await router.createSnippet('Move me', 'console.log(1);', 'any');

    await expect(router.moveSnippet(snippet.id, HUB_A.id)).rejects.toThrow(/snippet create access/);

    const entry = database.getSnippetRegistryEntry(snippet.id);
    expect(entry?.connectionId).toBe(CONN_A.id);
  });

  it('deleteSnippet removes registry metadata when the provider backend is unavailable', async () => {
    const { router, database } = await createRoutingFixture();
    const entry = database.addSnippetRegistryEntry({
      name: 'Offline snippet',
      connectionId: 'missing-conn',
      providerSnippetId: 1,
      scope: 'any'
    });

    await router.deleteSnippet(entry.id);

    expect(database.getSnippetRegistryEntry(entry.id)).toBeUndefined();
    expect(await router.listSnippets()).toEqual([]);
  });

  it('deleteSnippet detaches hub snippets locally when the hub backend is unavailable', async () => {
    const { router, database, rootDir } = await createRoutingFixture();
    database.setSetting(
      'teamHubs',
      JSON.stringify([
        {
          id: HUB_A.id,
          name: 'Local Admin',
          baseUrl: 'http://127.0.0.1:8788',
          token: 'hbk_test'
        }
      ])
    );

    const serverSnippetId = '770e8400-e29b-41d4-a716-446655440003';
    const idMap = new TeamHubIdMap(teamHubIdMapPath(rootDir, HUB_A.id));
    idMap.init();
    const localProviderId = idMap.toLocalId('snippet', serverSnippetId);
    idMap.close();

    const entry = database.addSnippetRegistryEntry({
      name: 'Hub snippet',
      connectionId: HUB_A.id,
      providerSnippetId: localProviderId,
      uuid: serverSnippetId,
      scope: 'any'
    });

    await router.deleteSnippet(entry.id);

    expect(database.getSnippetRegistryEntry(entry.id)).toBeUndefined();
    expect(await router.listSnippets()).toEqual([]);
    const detached = JSON.parse(
      database.getSetting(detachedSnippetSettingKey(HUB_A.id)) ?? '[]'
    ) as string[];
    expect(detached).toContain(serverSnippetId);

    const idMapAfterDelete = new TeamHubIdMap(teamHubIdMapPath(rootDir, HUB_A.id));
    idMapAfterDelete.init();
    expect(idMapAfterDelete.toServerId('snippet', localProviderId)).toBeUndefined();
    idMapAfterDelete.close();
  });
});

describeSqlite('RoutingStorage duplicateRequest uuid', () => {
  it('saveRequest insert without uuid mints a fresh request uuid', async () => {
    const { router } = await createRoutingFixture();
    const collection = await router.createCollection('API');
    const source = await router.saveRequest(baseRequestInput(collection.id, { name: 'Ping' }));

    // Mirrors sidebar Duplicate request: copy fields, omit uuid, suffix name.
    const copy = await router.saveRequest({
      collection_id: source.collection_id,
      folder_id: source.folder_id,
      name: `${source.name} (copy)`,
      method: source.method,
      url: source.url,
      headers: source.headers,
      params: source.params,
      body: source.body,
      body_type: source.body_type,
      body_raw: source.body_raw ?? null,
      body_raw_open: source.body_raw_open === true,
      pre_request_script: source.pre_request_script ?? '',
      post_request_script: source.post_request_script ?? '',
      comment: source.comment ?? '',
      tags: source.tags ?? '',
      auth: source.auth
    });

    expect(copy.id).not.toBe(source.id);
    expect(copy.uuid).not.toBe(source.uuid);
    expect(copy.uuid.trim()).not.toBe('');
  });
});

describeSqlite('RoutingStorage duplicateEnvironment', () => {
  it('copies environment name and variables with a fresh uuid', async () => {
    const { router } = await createRoutingFixture();
    const source = await router.createEnvironment('Staging');
    await router.updateEnvironment(source.id, 'Staging', [
      { key: 'baseUrl', value: 'https://staging.example.com', defaultValue: '', share: true },
      { key: 'token', value: 'secret', defaultValue: '', share: false }
    ]);

    const duplicated = await router.duplicateEnvironment(source.id);

    expect(duplicated.id).not.toBe(source.id);
    expect(duplicated.uuid).not.toBe(source.uuid);
    expect(duplicated.name).toBe('Staging (copy)');
    expect(duplicated.variables).toEqual([
      { key: 'baseUrl', value: 'https://staging.example.com', defaultValue: '', share: true },
      { key: 'token', value: 'secret', defaultValue: '', share: false }
    ]);

    const environments = await router.listEnvironments();
    expect(environments).toHaveLength(2);
    expect(environments.map((environment) => environment.name).sort()).toEqual([
      'Staging',
      'Staging (copy)'
    ]);
  });
});

describeSqlite('RoutingStorage syncProvider', () => {
  it('re-reads collections from a mounted database provider', async () => {
    const { router } = await createRoutingFixture({ mountB: false });
    await router.createCollection('Synced Collection');

    await expect(router.syncProvider(CONN_A.id)).resolves.toBeUndefined();
    const collections = await router.listCollections();
    expect(collections.map((item) => item.name)).toContain('Synced Collection');
  });

  it('throws when the provider is not mounted', async () => {
    const { router } = await createRoutingFixture({ mountB: false });
    await expect(router.syncProvider('missing-provider')).rejects.toThrow(
      'Provider "missing-provider" is not mounted.'
    );
  });
});

describeSqlite('RoutingStorage listCollections pruning', () => {
  it('removes hub registry entries when the remote provider returns an empty list', async () => {
    const staleServerId = '660e8400-e29b-41d4-a716-446655440001';
    const listCollections = vi.fn().mockResolvedValue([]);
    const { router, database, hubDb } = await createRoutingFixtureWithHub({ listCollections });

    const idMap = (hubDb as unknown as { idMap: TeamHubIdMap }).idMap;
    const localId = idMap.toLocalId('collection', staleServerId);

    database.addRegistryEntry({
      name: 'Pintail',
      connectionId: HUB_A.id,
      providerCollectionId: localId
    });

    const collections = await router.listCollections();

    expect(database.listRegistry()).toEqual([]);
    expect(collections).toEqual([]);
    expect(hubDb.getServerCollectionId(localId)).toBeUndefined();
  });

  it('keeps registry entries when the remote provider cannot be reached', async () => {
    const listCollections = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const { router, database } = await createRoutingFixtureWithHub({ listCollections });

    database.addRegistryEntry({
      name: 'Pintail',
      connectionId: HUB_A.id,
      providerCollectionId: 1
    });

    const collections = await router.listCollections();

    expect(database.listRegistry()).toHaveLength(1);
    expect(database.listRegistry()[0]?.name).toBe('Pintail');
    expect(collections).toHaveLength(1);
    expect(collections[0]?.name).toBe('Pintail');
  });

  it('does not return pruned collections in the list result', async () => {
    const listCollections = vi.fn().mockResolvedValue([]);
    const { router, database } = await createRoutingFixtureWithHub({ listCollections });

    const registryId = database.addRegistryEntry({
      name: 'Ghost',
      connectionId: HUB_A.id,
      providerCollectionId: 99
    }).id;

    const collections = await router.listCollections();

    expect(collections.some((item) => item.id === registryId)).toBe(false);
    expect(database.getRegistryEntry(registryId)).toBeUndefined();
  });
});

describeSqlite('RoutingStorage syncTeamHub', () => {
  it('removes registry entries for collections deleted on the server', async () => {
    const staleServerId = '660e8400-e29b-41d4-a716-446655440001';
    const listCollections = vi.fn().mockResolvedValue([]);
    const { router, database, hubDb } = await createRoutingFixtureWithHub({ listCollections });

    const idMap = (hubDb as unknown as { idMap: TeamHubIdMap }).idMap;
    const localId = idMap.toLocalId('collection', staleServerId);

    database.addRegistryEntry({
      name: 'Pintail',
      connectionId: HUB_A.id,
      providerCollectionId: localId
    });

    await router.syncTeamHub(HUB_A.id);

    expect(database.listRegistry()).toEqual([]);
    expect(hubDb.getServerCollectionId(localId)).toBeUndefined();
  });

  it('preserves registry entries when the hub cannot be reached', async () => {
    const listCollections = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const { router, database, hubDb } = await createRoutingFixtureWithHub({ listCollections });

    const idMap = (hubDb as unknown as { idMap: TeamHubIdMap }).idMap;
    const localId = idMap.toLocalId('collection', SERVER_COLLECTION_RECORD.id);

    database.addRegistryEntry({
      name: 'Pintail',
      connectionId: HUB_A.id,
      providerCollectionId: localId
    });

    await expect(router.syncTeamHub(HUB_A.id)).rejects.toThrow('Connection refused');
    expect(database.listRegistry()).toHaveLength(1);
    expect(database.listRegistry()[0]?.name).toBe('Pintail');
  });

  it('adds registry entries for new server collections', async () => {
    const listCollections = vi.fn().mockResolvedValue([SERVER_COLLECTION_RECORD]);
    const { router, database } = await createRoutingFixtureWithHub({ listCollections });

    await router.syncTeamHub(HUB_A.id);

    expect(database.listRegistry()).toHaveLength(1);
    expect(database.listRegistry()[0]?.name).toBe('Team API');
    expect(database.listRegistry()[0]?.connectionId).toBe(HUB_A.id);
  });

  it('skips collection import for admin-token team hub connections', async () => {
    const listCollections = vi.fn().mockResolvedValue([SERVER_COLLECTION_RECORD]);
    const { router, database } = await createRoutingFixtureWithHub({
      getSession: vi.fn().mockResolvedValue(userTeamHubSessionMock(true)),
      listCollections
    });

    await router.syncTeamHub(HUB_A.id);

    expect(database.listRegistry()).toEqual([]);
    expect(listCollections).not.toHaveBeenCalled();
  });

  it('purges stale sidebar entries when syncing an admin-token team hub', async () => {
    const listCollections = vi.fn().mockResolvedValue([SERVER_COLLECTION_RECORD]);
    const { router, database, hubDb } = await createRoutingFixtureWithHub({
      getSession: vi.fn().mockResolvedValue(userTeamHubSessionMock(true)),
      listCollections
    });

    const idMap = (hubDb as unknown as { idMap: TeamHubIdMap }).idMap;
    const localId = idMap.toLocalId('collection', SERVER_COLLECTION_RECORD.id);
    database.addRegistryEntry({
      name: 'Team API',
      connectionId: HUB_A.id,
      providerCollectionId: localId
    });

    await router.syncTeamHub(HUB_A.id);

    expect(database.listRegistry()).toEqual([]);
    expect(hubDb.getServerCollectionId(localId)).toBeUndefined();
    expect(listCollections).not.toHaveBeenCalled();
  });

  it('skips snippet sync when the hub does not expose /snippets', async () => {
    const listCollections = vi.fn().mockResolvedValue([]);
    const listSnippets = vi.fn().mockRejectedValue(
      new TeamHubClientError('Not Found', {
        status: 404,
        method: 'GET',
        path: '/snippets'
      })
    );
    const { router, database } = await createRoutingFixtureWithHub({
      listCollections,
      listSnippets
    });

    database.addSnippetRegistryEntry({
      name: 'Auth header',
      connectionId: HUB_A.id,
      providerSnippetId: 1,
      uuid: '550e8400-e29b-41d4-a716-446655440099',
      scope: 'any'
    });

    await expect(router.syncTeamHub(HUB_A.id)).resolves.toBeUndefined();

    expect(listSnippets).toHaveBeenCalledTimes(1);
    expect(database.listSnippetRegistry()).toHaveLength(1);
  });
});

describeSqlite('RoutingStorage deleteCollection team hub', () => {
  it('removes locked hub collections locally without calling remote delete', async () => {
    const lockedRecord = {
      ...SERVER_COLLECTION_RECORD,
      deletionLocked: true
    };
    const listCollections = vi
      .fn()
      .mockResolvedValueOnce([lockedRecord])
      .mockResolvedValueOnce([lockedRecord]);
    const deleteCollection = vi.fn().mockResolvedValue(undefined);
    const { router, database, hubDb } = await createRoutingFixtureWithHub({
      listCollections,
      deleteCollection
    });

    const idMap = (hubDb as unknown as { idMap: TeamHubIdMap }).idMap;
    const localId = idMap.toLocalId('collection', SERVER_COLLECTION_RECORD.id);
    const globalId = database.addRegistryEntry({
      name: 'Team API',
      connectionId: HUB_A.id,
      providerCollectionId: localId
    }).id;

    await router.deleteCollection(globalId);

    expect(deleteCollection).not.toHaveBeenCalled();
    expect(database.listRegistry()).toEqual([]);
    expect(hubDb.getServerCollectionId(localId)).toBeUndefined();

    const detached = JSON.parse(
      database.getSetting(detachedSettingKey(HUB_A.id)) ?? '[]'
    ) as string[];
    expect(detached).toContain(SERVER_COLLECTION_RECORD.id);
  });

  it('deletes unlocked hub collections on the server', async () => {
    const listCollections = vi.fn().mockResolvedValue([SERVER_COLLECTION_RECORD]);
    const deleteCollection = vi.fn().mockResolvedValue(undefined);
    const { router, database, hubDb } = await createRoutingFixtureWithHub({
      listCollections,
      deleteCollection
    });

    const idMap = (hubDb as unknown as { idMap: TeamHubIdMap }).idMap;
    const localId = idMap.toLocalId('collection', SERVER_COLLECTION_RECORD.id);
    const globalId = database.addRegistryEntry({
      name: 'Team API',
      connectionId: HUB_A.id,
      providerCollectionId: localId
    }).id;

    await router.deleteCollection(globalId);

    expect(deleteCollection).toHaveBeenCalledTimes(1);
    expect(database.listRegistry()).toEqual([]);
  });

  it('removes unlocked hub collections locally when the server rejects delete with 403', async () => {
    const listCollections = vi.fn().mockResolvedValue([SERVER_COLLECTION_RECORD]);
    const deleteCollection = vi.fn().mockRejectedValue(
      new TeamHubClientError('Forbidden', {
        status: 403,
        method: 'DELETE',
        path: `/collections/${SERVER_COLLECTION_RECORD.id}`
      })
    );
    const { router, database, hubDb } = await createRoutingFixtureWithHub({
      listCollections,
      deleteCollection
    });

    const idMap = (hubDb as unknown as { idMap: TeamHubIdMap }).idMap;
    const localId = idMap.toLocalId('collection', SERVER_COLLECTION_RECORD.id);
    const globalId = database.addRegistryEntry({
      name: 'Team API',
      connectionId: HUB_A.id,
      providerCollectionId: localId
    }).id;

    await router.deleteCollection(globalId);

    expect(deleteCollection).toHaveBeenCalledTimes(1);
    expect(database.listRegistry()).toEqual([]);
    expect(hubDb.getServerCollectionId(localId)).toBeUndefined();

    const detached = JSON.parse(
      database.getSetting(detachedSettingKey(HUB_A.id)) ?? '[]'
    ) as string[];
    expect(detached).toContain(SERVER_COLLECTION_RECORD.id);
  });

  it('propagates non-403 hub delete failures without removing the registry entry', async () => {
    const listCollections = vi.fn().mockResolvedValue([SERVER_COLLECTION_RECORD]);
    const deleteCollection = vi.fn().mockRejectedValue(
      new TeamHubClientError('Internal Server Error', {
        status: 500,
        method: 'DELETE',
        path: `/collections/${SERVER_COLLECTION_RECORD.id}`
      })
    );
    const { router, database, hubDb } = await createRoutingFixtureWithHub({
      listCollections,
      deleteCollection
    });

    const idMap = (hubDb as unknown as { idMap: TeamHubIdMap }).idMap;
    const localId = idMap.toLocalId('collection', SERVER_COLLECTION_RECORD.id);
    const globalId = database.addRegistryEntry({
      name: 'Team API',
      connectionId: HUB_A.id,
      providerCollectionId: localId
    }).id;

    await expect(router.deleteCollection(globalId)).rejects.toMatchObject({
      status: 500
    });
    expect(database.listRegistry()).toHaveLength(1);
    expect(hubDb.getServerCollectionId(localId)).toBe(SERVER_COLLECTION_RECORD.id);
  });

  it('includes deletion_locked when listing hub-backed collections', async () => {
    const lockedRecord = {
      ...SERVER_COLLECTION_RECORD,
      deletionLocked: true
    };
    const listCollections = vi.fn().mockResolvedValue([lockedRecord]);
    const { router, database, hubDb } = await createRoutingFixtureWithHub({ listCollections });

    const idMap = (hubDb as unknown as { idMap: TeamHubIdMap }).idMap;
    const localId = idMap.toLocalId('collection', SERVER_COLLECTION_RECORD.id);
    database.addRegistryEntry({
      name: 'Team API',
      connectionId: HUB_A.id,
      providerCollectionId: localId
    });

    const [collection] = await router.listCollections();
    expect(collection?.deletion_locked).toBe(true);
  });
});

describeSqlite('RoutingStorage migrateRegistryIfNeeded', () => {
  it('seeds registry from default provider collections', async () => {
    const { router, database, backendA, rootDir } = await createRoutingFixture();
    await backendA.createCollection('Existing');
    await backendA.createEnvironment('Dev');

    await router.migrateRegistryIfNeeded(join(rootDir, 'legacy-provider.db'));

    expect(database.listRegistry()).toHaveLength(1);
    expect(database.listRegistry()[0]?.name).toBe('Existing');
    expect(database.listEnvironments()).toHaveLength(1);
    expect(database.getSetting('__migrated__')).toBe('1');
  });
});

describeSqlite('RoutingStorage.create', () => {
  it('mounts SQLite and skips unconfigured remote providers on first launch', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'harborclient-routing-create-'));
    const database = new LocalDatabase(rootDir);
    await database.init();

    const sqliteId = 'sqlite-default';
    const connections: StorageConnection[] = [
      {
        id: sqliteId,
        name: 'SQLite',
        type: 'sqlite',
        settings: { ...BASE_SQLITE_SETTINGS }
      },
      {
        id: 'firestore-default',
        name: 'Firestore',
        type: 'firestore',
        settings: {
          apiKey: '',
          authDomain: '',
          projectId: '',
          appId: '',
          email: '',
          password: ''
        }
      },
      {
        id: 'mysql-default',
        name: 'MySQL',
        type: 'mysql',
        settings: {
          host: '127.0.0.1',
          port: 3306,
          user: '',
          password: '',
          database: ''
        }
      },
      {
        id: 'postgres-default',
        name: 'PostgreSQL',
        type: 'postgres',
        settings: {
          host: '127.0.0.1',
          port: 5432,
          user: '',
          password: '',
          database: ''
        }
      }
    ];
    const slots = Object.fromEntries(connections.map((conn, index) => [conn.id, index]));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const router = await RoutingStorage.create(database, sqliteId, connections, [], slots, rootDir);

    expect(router.isConnectionMounted(sqliteId)).toBe(true);
    expect(router.isConnectionMounted('firestore-default')).toBe(false);
    expect(router.isConnectionMounted('mysql-default')).toBe(false);
    expect(router.isConnectionMounted('postgres-default')).toBe(false);
    expect(router.hasDefaultProvider()).toBe(true);
    expect(
      warnSpy.mock.calls.some(([message]) =>
        String(message).includes(
          'Skipping database "Firestore" (firestore): settings are incomplete'
        )
      )
    ).toBe(true);

    warnSpy.mockRestore();
    await router.close();
    rmSync(rootDir, { recursive: true, force: true });
  });
});

describeSqlite('RoutingStorage collection discovery', () => {
  it('lists only unregistered collections on a provider', async () => {
    const { router, backendB } = await createRoutingFixture();
    await backendB.createCollection('Existing A');
    await backendB.createCollection('Existing B');

    const unregistered = await router.listUnregisteredCollections(CONN_B.id);
    expect(unregistered).toHaveLength(2);
    expect(unregistered.map((collection) => collection.name).sort()).toEqual([
      'Existing A',
      'Existing B'
    ]);
  });

  it('excludes collections already in the registry', async () => {
    const { router, database, backendB } = await createRoutingFixture();
    const registered = await backendB.createCollection('Registered');
    database.addRegistryEntry({
      name: registered.name,
      connectionId: CONN_B.id,
      providerCollectionId: registered.id,
      collectionUuid: registered.uuid
    });
    await backendB.createCollection('Unregistered');

    const unregistered = await router.listUnregisteredCollections(CONN_B.id);
    expect(unregistered).toHaveLength(1);
    expect(unregistered[0]?.name).toBe('Unregistered');
  });

  it('registers only selected discovered collections', async () => {
    const { router, backendB } = await createRoutingFixture();
    const first = await backendB.createCollection('Alpha');
    await backendB.createCollection('Beta');

    const added = await router.registerDiscoveredCollections(CONN_B.id, [first.id]);
    expect(added).toBe(1);

    const listed = await router.listCollections();
    expect(listed.some((collection) => collection.name === 'Alpha')).toBe(true);
    expect(listed.some((collection) => collection.name === 'Beta')).toBe(false);

    const remaining = await router.listUnregisteredCollections(CONN_B.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.name).toBe('Beta');
  });

  it('listGitStatuses returns statuses for healthy git backends when one fails', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'harborclient-routing-git-status-'));
    const repoPathA = mkdtempSync(join(tmpdir(), 'harborclient-git-repo-a-'));
    const repoPathB = mkdtempSync(join(tmpdir(), 'harborclient-git-repo-b-'));
    mkdirSync(join(repoPathA, '.harborclient'), { recursive: true });
    mkdirSync(join(repoPathB, '.harborclient'), { recursive: true });

    const database = new LocalDatabase(rootDir);
    await database.init();

    const gitConnA: StorageConnection = {
      id: 'git-a',
      name: 'Git A',
      type: 'git',
      settings: {
        repoPath: repoPathA,
        url: 'https://github.com/example/a.git',
        branch: 'main',
        subdir: '.harborclient',
        auth: { kind: 'pat', username: 'token' }
      }
    };

    const gitConnB: StorageConnection = {
      id: 'git-b',
      name: 'Git B',
      type: 'git',
      settings: {
        repoPath: repoPathB,
        url: 'https://github.com/example/b.git',
        branch: 'develop',
        subdir: '.harborclient',
        auth: { kind: 'pat', username: 'token' }
      }
    };

    const gitDbA = new GitStorage(gitConnA.id, gitConnA.settings, rootDir);
    const gitDbB = new GitStorage(gitConnB.id, gitConnB.settings, rootDir);
    await gitDbA.init();
    await gitDbB.init();

    const router = new RoutingStorage(database, gitConnA.id, rootDir);
    router.mount(0, gitConnA, gitDbA);
    router.mount(1, gitConnB, gitDbB);

    vi.spyOn(gitDbA, 'getSourceControlStatus').mockRejectedValue(new Error('status read failed'));
    vi.spyOn(gitDbB, 'getSourceControlStatus').mockResolvedValue({
      changedCount: 2,
      stagedCount: 1,
      unstagedCount: 1,
      branch: 'develop',
      ahead: 0,
      behind: 0,
      syncKnown: false,
      conflictCount: 0,
      harborRootExists: true,
      harborSubdir: '.harborclient'
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const statuses = await router.listGitStatuses();

    expect(statuses['git-a']).toBeUndefined();
    expect(statuses['git-b']).toEqual({
      changedCount: 2,
      stagedCount: 1,
      unstagedCount: 1,
      branch: 'develop',
      ahead: 0,
      behind: 0,
      syncKnown: false,
      conflictCount: 0,
      harborRootExists: true,
      harborSubdir: '.harborclient'
    });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
    await router.close();
    rmSync(rootDir, { recursive: true, force: true });
    rmSync(repoPathA, { recursive: true, force: true });
    rmSync(repoPathB, { recursive: true, force: true });
  });

  it('skips git reconcile at startup when collectionDiscoverySkipped is set', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'harborclient-routing-git-skip-'));
    const repoPath = mkdtempSync(join(tmpdir(), 'harborclient-routing-git-repo-'));
    mkdirSync(join(repoPath, '.harborclient'), { recursive: true });

    const database = new LocalDatabase(rootDir);
    await database.init();

    const gitConnection: StorageConnection = {
      id: 'git-skip',
      name: 'Git Skip',
      type: 'git',
      collectionDiscoverySkipped: true,
      settings: {
        repoPath,
        url: 'https://github.com/example/repo.git',
        branch: 'main',
        subdir: '.harborclient',
        auth: { kind: 'pat', username: 'token' }
      }
    };

    const gitDb = new GitStorage(gitConnection.id, gitConnection.settings, rootDir);
    await gitDb.init();
    await gitDb.createCollection('On Disk');
    await gitDb.close();

    const reconcileSpy = vi.spyOn(RoutingStorage.prototype, 'reconcileGitRegistry');

    const router = await RoutingStorage.create(
      database,
      gitConnection.id,
      [gitConnection],
      [],
      { [gitConnection.id]: 0 },
      rootDir
    );

    expect(reconcileSpy).not.toHaveBeenCalled();
    expect(database.listRegistry()).toHaveLength(0);

    reconcileSpy.mockRestore();
    await router.close();
    rmSync(rootDir, { recursive: true, force: true });
    rmSync(repoPath, { recursive: true, force: true });
  });
});
