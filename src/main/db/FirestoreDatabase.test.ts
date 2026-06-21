import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { FirestoreDatabase } from '#/main/db/FirestoreDatabase';
import { defaultAuth } from '#/shared/auth';
import {
  closeSharedSqlBackends,
  createFirestoreTestDbFactory,
  describeFirestore,
  TEST_FIRESTORE_SETTINGS
} from '#/test/databaseBackends';
import {
  runIdatabaseContractSuite,
  baseRequestInput,
  type TestDbHandle
} from '#/test/idatabaseContract';
import type { CollectionExport } from '#/shared/types';

const cleanups: Array<() => void | Promise<void>> = [];

/**
 * Creates an isolated Firestore database instance for unit tests.
 *
 * @returns Configured test database handle.
 */
async function createTestDb(): Promise<TestDbHandle> {
  const handle = await createFirestoreTestDbFactory()();
  if (handle.cleanup) {
    cleanups.push(handle.cleanup);
  }
  return handle;
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
});

describeFirestore('FirestoreDatabase lifecycle', () => {
  it('throws when accessed before init', async () => {
    const db = new FirestoreDatabase(TEST_FIRESTORE_SETTINGS);
    await expect(db.listCollections()).rejects.toThrow('Database not initialized');
  });
});

describeFirestore('FirestoreDatabase contract', () => {
  runIdatabaseContractSuite('FirestoreDatabase', createTestDb);
});

describeFirestore('FirestoreDatabase reorder ownership', () => {
  it('reorderFolders rejects folders from another collection', async () => {
    const { db } = await createTestDb();
    const collectionA = await db.createCollection('Collection A');
    const collectionB = await db.createCollection('Collection B');
    const folderA = await db.createFolder(collectionA.id, 'Folder A');
    const folderB = await db.createFolder(collectionB.id, 'Folder B');

    await expect(db.reorderFolders(collectionA.id, [folderA.id, folderB.id])).rejects.toThrow(
      'Folder not found'
    );

    expect((await db.listFolders(collectionB.id)).map((folder) => folder.id)).toEqual([folderB.id]);
  });

  it('reorderRequests rejects requests from another collection or folder', async () => {
    const { db } = await createTestDb();
    const collectionA = await db.createCollection('Collection A');
    const collectionB = await db.createCollection('Collection B');
    const folderA = await db.createFolder(collectionA.id, 'Folder A');
    const folderB = await db.createFolder(collectionB.id, 'Folder B');
    const requestA = await db.saveRequest(
      baseRequestInput(collectionA.id, { name: 'Request A', folder_id: folderA.id })
    );
    const requestB = await db.saveRequest(
      baseRequestInput(collectionB.id, { name: 'Request B', folder_id: folderB.id })
    );

    await expect(
      db.reorderRequests(collectionA.id, folderA.id, [requestA.id, requestB.id])
    ).rejects.toThrow('Request not found');

    expect((await db.listRequests(collectionB.id)).map((request) => request.id)).toEqual([
      requestB.id
    ]);
    const remaining = (await db.listRequests(collectionB.id)).find(
      (request) => request.id === requestB.id
    );
    expect(remaining?.folder_id).toBe(folderB.id);
  });
});

describeFirestore('FirestoreDatabase import and ID allocation', () => {
  /**
   * Builds a minimal exported request payload for bulk import tests.
   *
   * @param index - Request index used for the display name.
   */
  function buildExportedRequest(index: number): CollectionExport['requests'][number] {
    return {
      name: `Request ${index}`,
      method: 'GET',
      url: `https://example.com/${index}`,
      headers: [],
      params: [],
      body: '',
      body_type: 'none',
      pre_request_script: '',
      post_request_script: '',
      comment: '',
      sort_order: index,
      folder_name: null
    };
  }

  it('importCollectionData batch-imports collections larger than the writeBatch limit', async () => {
    const { db } = await createTestDb();
    const requestCount = 600;
    const payload: CollectionExport = {
      formatVersion: 2,
      name: 'Large Import',
      variables: [],
      headers: [],
      pre_request_script: '',
      post_request_script: '',
      folders: [
        { name: 'Alpha', sort_order: 0 },
        { name: 'Beta', sort_order: 1 }
      ],
      requests: Array.from({ length: requestCount }, (_, index) => buildExportedRequest(index))
    };

    const imported = await db.importCollectionData(payload);

    expect(imported.name).toBe('Large Import');
    expect(await db.listFolders(imported.id)).toHaveLength(2);
    expect(await db.listRequests(imported.id)).toHaveLength(requestCount);
  });

  it('deleteCollection batch-deletes collections larger than the writeBatch limit', async () => {
    const { db } = await createTestDb();
    const requestCount = 600;
    const payload: CollectionExport = {
      formatVersion: 2,
      name: 'Large Delete',
      variables: [],
      headers: [],
      pre_request_script: '',
      post_request_script: '',
      folders: [
        { name: 'Alpha', sort_order: 0 },
        { name: 'Beta', sort_order: 1 }
      ],
      requests: Array.from({ length: requestCount }, (_, index) => buildExportedRequest(index))
    };

    const imported = await db.importCollectionData(payload);
    await db.deleteCollection(imported.id);

    expect(await db.listCollections()).toEqual([]);
    expect(await db.listRequests(imported.id)).toEqual([]);
    expect(await db.listFolders(imported.id)).toEqual([]);
  });

  it('deleteFolder batch-deletes folders larger than the writeBatch limit', async () => {
    const { db } = await createTestDb();
    const requestCount = 600;
    const folderName = 'Large';
    const payload: CollectionExport = {
      formatVersion: 2,
      name: 'Large Folder Delete',
      variables: [],
      headers: [],
      pre_request_script: '',
      post_request_script: '',
      folders: [{ name: folderName, sort_order: 0 }],
      requests: Array.from({ length: requestCount }, (_, index) => ({
        ...buildExportedRequest(index),
        folder_name: folderName
      }))
    };

    const imported = await db.importCollectionData(payload);
    const [folder] = await db.listFolders(imported.id);
    await db.deleteFolder(folder.id);

    expect(await db.listFolders(imported.id)).toEqual([]);
    expect(await db.listRequests(imported.id)).toEqual([]);
    expect(await db.listCollections()).toEqual([imported]);
  });

  it('nextId dispenses IDs from cached blocks instead of one transaction per insert', async () => {
    const { db } = await createTestDb();
    // `runTransaction` is a non-configurable ESM export and cannot be spied on,
    // so count calls to the sole caller instead: each block allocation runs
    // exactly one Firestore transaction.
    const allocateIdsSpy = vi.spyOn(
      FirestoreDatabase.prototype as unknown as {
        allocateIds: (counterName: string, count: number) => Promise<number[]>;
      },
      'allocateIds'
    );
    allocateIdsSpy.mockClear();

    const collection = await db.createCollection('Block Allocation');
    for (let index = 0; index < 51; index += 1) {
      await db.saveRequest({
        collection_id: collection.id,
        name: `Request ${index}`,
        method: 'GET',
        url: `https://example.com/${index}`,
        headers: [],
        params: [],
        body: '',
        body_type: 'none',
        pre_request_script: '',
        post_request_script: '',
        comment: '',
        auth: defaultAuth()
      });
    }

    const requests = await db.listRequests(collection.id);
    const requestIds = requests.map((request) => request.id).sort((a, b) => a - b);

    expect(requests).toHaveLength(51);
    expect(new Set(requestIds).size).toBe(51);
    expect(allocateIdsSpy.mock.calls.length).toBeLessThan(10);
    allocateIdsSpy.mockRestore();
  });
});

afterAll(async () => {
  await closeSharedSqlBackends();
});
