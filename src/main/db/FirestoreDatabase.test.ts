import * as firestore from 'firebase/firestore';
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import { FirestoreDatabase } from '#/main/db/FirestoreDatabase';
import {
  closeSharedSqlBackends,
  createFirestoreTestDbFactory,
  describeFirestore,
  TEST_FIRESTORE_SETTINGS
} from '#/test/databaseBackends';
import { runIdatabaseContractSuite, type TestDbHandle } from '#/test/idatabaseContract';
import type { CollectionExport } from '#/shared/types';

const cleanups: Array<() => void | Promise<void>> = [];

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

  it('nextId dispenses IDs from cached blocks instead of one transaction per insert', async () => {
    const { db } = await createTestDb();
    const transactionSpy = vi.spyOn(firestore, 'runTransaction');
    transactionSpy.mockClear();

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
        comment: ''
      });
    }

    const requests = await db.listRequests(collection.id);
    const requestIds = requests.map((request) => request.id).sort((a, b) => a - b);

    expect(requests).toHaveLength(51);
    expect(new Set(requestIds).size).toBe(51);
    expect(transactionSpy.mock.calls.length).toBeLessThan(10);
    transactionSpy.mockRestore();
  });
});

afterAll(async () => {
  await closeSharedSqlBackends();
});
