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
