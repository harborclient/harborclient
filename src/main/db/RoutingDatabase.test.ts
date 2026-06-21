import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, expect, it, vi } from 'vitest';
import type { DatabaseConnection, SqliteSettings } from '#/shared/types';
import { decodeGlobalId, ID_OFFSET } from '#/main/db/idNamespace';
import { LocalRegistry } from '#/main/db/LocalRegistry';
import { RoutingDatabase } from '#/main/db/RoutingDatabase';
import { SqliteDatabase } from '#/main/db/SqliteDatabase';
import { baseRequestInput } from '#/test/idatabaseContract';
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

const CONN_A: DatabaseConnection = {
  id: 'conn-a',
  name: 'SQLite A',
  type: 'sqlite',
  settings: { ...BASE_SQLITE_SETTINGS, dbFilename: 'a.db' }
};

const CONN_B: DatabaseConnection = {
  id: 'conn-b',
  name: 'SQLite B',
  type: 'sqlite',
  settings: { ...BASE_SQLITE_SETTINGS, dbFilename: 'b.db' }
};

const cleanups: Array<() => void | Promise<void>> = [];

/**
 * Builds a routing database fixture with mounted backends for tests.
 *
 * @param options - Optional flags such as whether to mount a second backend.
 * @returns Test routing database, registry, backends, and temp root directory.
 */
async function createRoutingFixture(options?: { mountB?: boolean }): Promise<{
  router: RoutingDatabase;
  registry: LocalRegistry;
  backendA: SqliteDatabase;
  backendB: SqliteDatabase;
  rootDir: string;
}> {
  const rootDir = mkdtempSync(join(tmpdir(), 'harborclient-routing-'));
  const registry = new LocalRegistry(rootDir);
  await registry.init();

  const backendADir = join(rootDir, 'backend-a');
  const backendBDir = join(rootDir, 'backend-b');
  mkdirSync(backendADir, { recursive: true });
  mkdirSync(backendBDir, { recursive: true });

  const backendA = new SqliteDatabase(backendADir, CONN_A.settings as SqliteSettings);
  const backendB = new SqliteDatabase(backendBDir, CONN_B.settings as SqliteSettings);
  await backendA.init();
  await backendB.init();

  const router = new RoutingDatabase(registry, CONN_A.id);
  router.mount(0, CONN_A, backendA);
  if (options?.mountB !== false) {
    router.mount(1, CONN_B, backendB);
  }

  cleanups.push(async () => {
    await router.close();
    rmSync(rootDir, { recursive: true, force: true });
  });

  return { router, registry, backendA, backendB, rootDir };
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describeSqlite('RoutingDatabase collections', () => {
  it('createCollection registers in registry and provider with stable global id', async () => {
    const { router, registry } = await createRoutingFixture();
    const created = await router.createCollection('My API');

    expect(created.id).toEqual(expect.any(Number));
    expect(created.name).toBe('My API');
    expect(created.connectionId).toBe(CONN_A.id);

    const entry = registry.getRegistryEntry(created.id);
    expect(entry?.connectionId).toBe(CONN_A.id);
    expect(entry?.providerCollectionId).toEqual(expect.any(Number));

    const listed = await router.listCollections();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);
    expect(listed[0]?.name).toBe('My API');
  });

  it('listCollections tolerates an unmounted provider', async () => {
    const { router, registry } = await createRoutingFixture({ mountB: false });
    registry.addRegistryEntry({
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
    const { router, registry, backendA } = await createRoutingFixture();
    await router.createCollection('Healthy');

    registry.addRegistryEntry({
      name: 'Remote',
      connectionId: CONN_B.id,
      providerCollectionId: 99
    });

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
    const { router, registry, backendA } = await createRoutingFixture();
    vi.spyOn(registry, 'addRegistryEntry').mockImplementationOnce(() => {
      throw new Error('Registry write failed');
    });

    await expect(router.createCollection('Orphan')).rejects.toThrow('Registry write failed');
    expect(await backendA.listCollections()).toEqual([]);
    expect(registry.listRegistry()).toEqual([]);
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
    const { router, registry, backendA } = await createRoutingFixture();
    vi.spyOn(registry, 'addRegistryEntry').mockImplementationOnce(() => {
      throw new Error('Registry write failed');
    });

    const payload = {
      harborclientVersion: 2 as const,
      harborclientExport: 'collection' as const,
      name: 'Imported API',
      variables: [],
      headers: [],
      pre_request_script: '',
      post_request_script: '',
      folders: [],
      requests: []
    };

    await expect(router.importCollectionData(payload)).rejects.toThrow('Registry write failed');
    expect(await backendA.listCollections()).toEqual([]);
    expect(registry.listRegistry()).toEqual([]);
  });
});

describeSqlite('RoutingDatabase global ids', () => {
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

describeSqlite('RoutingDatabase moveCollection', () => {
  it('copies collection data to another backend and updates registry', async () => {
    const { router, registry, backendA, backendB } = await createRoutingFixture();
    const collection = await router.createCollection('Move Me');
    const folder = await router.createFolder(collection.id, 'Auth');
    await router.saveRequest(
      baseRequestInput(collection.id, { name: 'Login', folder_id: folder.id, method: 'POST' })
    );
    await router.saveRequest(baseRequestInput(collection.id, { name: 'Health' }));

    const globalId = collection.id;
    const moved = await router.moveCollection(globalId, CONN_B.id);

    expect(moved.id).toBe(globalId);
    expect(moved.connectionId).toBe(CONN_B.id);

    const entryAfter = registry.getRegistryEntry(globalId)!;
    expect(entryAfter.connectionId).toBe(CONN_B.id);

    expect(await backendA.listCollections()).toEqual([]);
    const targetCollections = await backendB.listCollections();
    expect(targetCollections).toHaveLength(1);

    const movedRequests = await router.listRequests(globalId);
    expect(movedRequests.map((r) => r.name).sort()).toEqual(['Health', 'Login']);
    expect(movedRequests.every((r) => r.collection_id === globalId)).toBe(true);

    const movedFolders = await router.listFolders(globalId);
    expect(movedFolders.map((f) => f.name)).toEqual(['Auth']);
  });

  it('returns existing collection when target connection is unchanged', async () => {
    const { router } = await createRoutingFixture();
    const collection = await router.createCollection('Same Connection');
    const moved = await router.moveCollection(collection.id, CONN_A.id);
    expect(moved.id).toBe(collection.id);
    expect(moved.connectionId).toBe(CONN_A.id);
  });
});

describeSqlite('RoutingDatabase duplicateCollection', () => {
  it('copies collection settings, folders, and requests on the same backend', async () => {
    const { router, registry, backendA } = await createRoutingFixture();
    const collection = await router.createCollection('Source API');
    await router.updateCollection(
      collection.id,
      'Source API',
      [{ key: 'baseUrl', value: 'https://api.example.com', defaultValue: '', share: true }],
      [{ key: 'Accept', value: 'application/json', enabled: true }],
      'console.log("pre")',
      'console.log("post")',
      {
        type: 'bearer',
        basic: { username: '', password: '' },
        bearer: { token: 'source-token' }
      }
    );
    const folder = await router.createFolder(collection.id, 'Auth');
    await router.saveRequest(
      baseRequestInput(collection.id, { name: 'Login', folder_id: folder.id, method: 'POST' })
    );
    await router.saveRequest(baseRequestInput(collection.id, { name: 'Health' }));

    const duplicated = await router.duplicateCollection(collection.id);

    expect(duplicated.id).not.toBe(collection.id);
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
      type: 'bearer',
      basic: { username: '', password: '' },
      bearer: { token: 'source-token' }
    });

    expect(registry.listRegistry()).toHaveLength(2);

    const originalRequests = await router.listRequests(collection.id);
    expect(originalRequests.map((r) => r.name).sort()).toEqual(['Health', 'Login']);
    expect((await router.listFolders(collection.id)).map((f) => f.name)).toEqual(['Auth']);

    const copyRequests = await router.listRequests(duplicated.id);
    expect(copyRequests.map((r) => r.name).sort()).toEqual(['Health', 'Login']);
    expect(copyRequests.every((r) => r.collection_id === duplicated.id)).toBe(true);

    const copyFolders = await router.listFolders(duplicated.id);
    expect(copyFolders.map((f) => f.name)).toEqual(['Auth']);
    expect(copyFolders[0]?.id).not.toBe(folder.id);

    expect(await backendA.listCollections()).toHaveLength(2);
  });
});

describeSqlite('RoutingDatabase migrateRegistryIfNeeded', () => {
  it('seeds registry from default provider collections', async () => {
    const { router, registry, backendA, rootDir } = await createRoutingFixture();
    await backendA.createCollection('Existing');
    await backendA.createEnvironment('Dev');

    await router.migrateRegistryIfNeeded(join(rootDir, 'legacy-provider.db'));

    expect(registry.listRegistry()).toHaveLength(1);
    expect(registry.listRegistry()[0]?.name).toBe('Existing');
    expect(registry.listEnvironments()).toHaveLength(1);
    expect(registry.getSetting('__migrated__')).toBe('1');
  });
});
