import { describe, expect, it } from 'vitest';
import type { IDatabase } from '#/main/db/IDatabase';
import { defaultAuth } from '#/shared/auth';
import type { CollectionExport, SaveRequestInput } from '#/shared/types';

export interface TestDbHandle {
  db: IDatabase;
  cleanup?: () => void | Promise<void>;
}

export type CreateTestDb = () => Promise<TestDbHandle>;

/**
 * Builds a minimal save-request payload for contract tests.
 */
export function baseRequestInput(
  collectionId: number,
  overrides: Partial<SaveRequestInput> = {}
): SaveRequestInput {
  return {
    collection_id: collectionId,
    name: 'Test Request',
    method: 'GET',
    url: 'https://example.com',
    headers: [{ key: 'X-Test', value: '1', enabled: true }],
    params: [{ key: 'q', value: 'search', enabled: true }],
    body: '',
    body_type: 'none',
    pre_request_script: '',
    post_request_script: '',
    comment: '',
    auth: defaultAuth(),
    ...overrides
  };
}

/**
 * Runs shared IDatabase contract tests against any backend factory.
 */
export function runIdatabaseContractSuite(label: string, createTestDb: CreateTestDb): void {
  describe(`${label} collections`, () => {
    it('listCollections returns empty after init', async () => {
      const { db } = await createTestDb();
      expect(await db.listCollections()).toEqual([]);
    });

    it('createCollection returns trimmed defaults', async () => {
      const { db } = await createTestDb();
      const collection = await db.createCollection('  My API  ');

      expect(collection.id).toEqual(expect.any(Number));
      expect(collection.name).toBe('My API');
      expect(collection.variables).toEqual([]);
      expect(collection.headers).toEqual([]);
      expect(collection.auth).toEqual(defaultAuth());
      expect(collection.pre_request_script).toBe('');
      expect(collection.post_request_script).toBe('');
      expect(collection.created_at).toEqual(expect.any(String));
    });

    it('createCollection rejects empty name after trim', async () => {
      const { db } = await createTestDb();
      await expect(db.createCollection('   ')).rejects.toThrow('Collection name is required');
    });

    it('updateCollection rejects empty name after trim', async () => {
      const { db } = await createTestDb();
      const created = await db.createCollection('Original');
      await expect(
        db.updateCollection(created.id, '  ', [], [], '', '', defaultAuth())
      ).rejects.toThrow('Collection name is required');
    });

    it('listCollections sorts by name ascending', async () => {
      const { db } = await createTestDb();
      await db.createCollection('Zebra');
      await db.createCollection('Alpha');
      await db.createCollection('Middle');

      expect((await db.listCollections()).map((c) => c.name)).toEqual(['Alpha', 'Middle', 'Zebra']);
    });

    it('updateCollection persists fields and returns updated row', async () => {
      const { db } = await createTestDb();
      const created = await db.createCollection('Original');

      const updated = await db.updateCollection(
        created.id,
        '  Updated  ',
        [{ key: 'host', value: 'api.example.com', defaultValue: '', share: true }],
        [{ key: 'Authorization', value: 'Bearer token', enabled: true }],
        'console.log("pre");',
        'console.log("post");',
        {
          type: 'bearer',
          basic: { username: '', password: '' },
          bearer: { token: 'collection-token' }
        }
      );

      expect(updated).toMatchObject({
        id: created.id,
        name: 'Updated',
        variables: [{ key: 'host', value: 'api.example.com', defaultValue: '', share: true }],
        headers: [{ key: 'Authorization', value: 'Bearer token', enabled: true }],
        auth: {
          type: 'bearer',
          basic: { username: '', password: '' },
          bearer: { token: 'collection-token' }
        },
        pre_request_script: 'console.log("pre");',
        post_request_script: 'console.log("post");'
      });
      expect((await db.listCollections())[0]).toEqual(updated);
    });

    it('updateCollection throws when collection is missing', async () => {
      const { db } = await createTestDb();
      await expect(
        db.updateCollection(999, 'Missing', [], [], '', '', defaultAuth())
      ).rejects.toThrow('Collection not found');
    });

    it('deleteCollection removes the collection', async () => {
      const { db } = await createTestDb();
      const collection = await db.createCollection('To Delete');
      await db.deleteCollection(collection.id);
      expect(await db.listCollections()).toEqual([]);
    });
  });

  describe(`${label} environments`, () => {
    it('listEnvironments returns environment after createEnvironment', async () => {
      const { db } = await createTestDb();
      const env = await db.createEnvironment('  Dev  ');
      expect(env.name).toBe('Dev');
      expect((await db.listEnvironments()).map((e) => e.name)).toEqual(['Dev']);
    });

    it('createEnvironment rejects empty name after trim', async () => {
      const { db } = await createTestDb();
      await expect(db.createEnvironment('   ')).rejects.toThrow('Environment name is required');
    });

    it('updateEnvironment persists variables', async () => {
      const { db } = await createTestDb();
      const created = await db.createEnvironment('Dev');
      const updated = await db.updateEnvironment(created.id, 'Staging', [
        { key: 'baseUrl', value: 'https://staging.example.com', defaultValue: '', share: true }
      ]);
      expect(updated.name).toBe('Staging');
      expect(updated.variables).toEqual([
        { key: 'baseUrl', value: 'https://staging.example.com', defaultValue: '', share: true }
      ]);
    });

    it('deleteEnvironment removes the environment', async () => {
      const { db } = await createTestDb();
      const env = await db.createEnvironment('Temp');
      await db.deleteEnvironment(env.id);
      expect(await db.listEnvironments()).toEqual([]);
    });
  });

  describe(`${label} requests`, () => {
    it('saveRequest inserts with auto-incremented sort_order', async () => {
      const { db } = await createTestDb();
      const collection = await db.createCollection('Requests');

      const first = await db.saveRequest(baseRequestInput(collection.id, { name: 'First' }));
      const second = await db.saveRequest(baseRequestInput(collection.id, { name: 'Second' }));

      expect(first.sort_order).toBe(0);
      expect(second.sort_order).toBe(1);
      expect(first.id).not.toBe(second.id);
    });

    it('saveRequest rejects empty name after trim', async () => {
      const { db } = await createTestDb();
      const collection = await db.createCollection('Requests');
      await expect(
        db.saveRequest(baseRequestInput(collection.id, { name: '   ' }))
      ).rejects.toThrow('Request name is required');
    });

    it('saveRequest updates existing request fields', async () => {
      const { db } = await createTestDb();
      const collection = await db.createCollection('Requests');
      const created = await db.saveRequest(baseRequestInput(collection.id));

      const updated = await db.saveRequest({
        ...baseRequestInput(collection.id),
        id: created.id,
        name: 'Updated Request',
        method: 'POST',
        url: 'https://api.example.com',
        body: '{"ok":true}',
        body_type: 'json',
        pre_request_script: 'pre',
        post_request_script: 'post',
        comment: 'Some notes'
      });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe('Updated Request');
      expect(updated.method).toBe('POST');
      expect(updated.url).toBe('https://api.example.com');
      expect(updated.body).toBe('{"ok":true}');
      expect(updated.body_type).toBe('json');
      expect(updated.pre_request_script).toBe('pre');
      expect(updated.post_request_script).toBe('post');
      expect(updated.comment).toBe('Some notes');
      expect((await db.listRequests(collection.id))[0]).toEqual(updated);
    });

    it('saveRequest inserts when update id does not exist', async () => {
      const { db } = await createTestDb();
      const collection = await db.createCollection('Requests');

      const saved = await db.saveRequest({
        ...baseRequestInput(collection.id),
        id: 99999,
        name: 'New Request'
      });

      expect(saved.id).not.toBe(99999);
      expect(saved.name).toBe('New Request');
      expect(await db.listRequests(collection.id)).toHaveLength(1);
    });

    it('listRequests orders by sort_order then name', async () => {
      const { db } = await createTestDb();
      const collection = await db.createCollection('Requests');

      await db.saveRequest(baseRequestInput(collection.id, { name: 'Bravo' }));
      await db.saveRequest(baseRequestInput(collection.id, { name: 'Alpha' }));

      expect((await db.listRequests(collection.id)).map((r) => r.name)).toEqual(['Bravo', 'Alpha']);
    });

    it('deleteRequest removes the request', async () => {
      const { db } = await createTestDb();
      const collection = await db.createCollection('Requests');
      const request = await db.saveRequest(baseRequestInput(collection.id));

      await db.deleteRequest(request.id);
      expect(await db.listRequests(collection.id)).toEqual([]);
    });

    it('deleteCollection cascades to requests', async () => {
      const { db } = await createTestDb();
      const collection = await db.createCollection('Requests');
      await db.saveRequest(baseRequestInput(collection.id));

      await db.deleteCollection(collection.id);
      expect(await db.listRequests(collection.id)).toEqual([]);
    });
  });

  describe(`${label} settings`, () => {
    it('getSetting returns undefined when unset', async () => {
      const { db } = await createTestDb();
      expect(await db.getSetting('theme')).toBeUndefined();
    });

    it('getSetting returns latest value after setSetting overwrites a key', async () => {
      const { db } = await createTestDb();

      await db.setSetting('theme', 'dark');
      expect(await db.getSetting('theme')).toBe('dark');

      await db.setSetting('theme', 'light');
      expect(await db.getSetting('theme')).toBe('light');
    });
  });

  describe(`${label} import and export`, () => {
    it('exportCollectionData throws for missing collection', async () => {
      const { db } = await createTestDb();
      await expect(db.exportCollectionData(999)).rejects.toThrow('Collection not found');
    });

    it('exportCollectionData returns portable payload without database ids', async () => {
      const { db } = await createTestDb();
      const collection = await db.createCollection('Export Me');
      await db.updateCollection(
        collection.id,
        'Export Me',
        [
          { key: 'shared', value: 'visible', defaultValue: '', share: true },
          { key: 'private', value: 'secret', defaultValue: '', share: false }
        ],
        [{ key: 'X-Header', value: '1', enabled: true }],
        'pre script',
        'post script',
        {
          type: 'basic',
          basic: { username: 'admin', password: 'secret' },
          bearer: { token: '' }
        }
      );
      await db.saveRequest(
        baseRequestInput(collection.id, {
          name: 'Get Users',
          method: 'GET',
          url: 'https://api.example.com/users',
          pre_request_script: 'req pre',
          post_request_script: 'req post',
          comment: 'Request notes'
        })
      );

      const exported = await db.exportCollectionData(collection.id);

      expect(exported).toEqual({
        harborclientVersion: 2,
        harborclientExport: 'collection',
        name: 'Export Me',
        variables: [
          { key: 'shared', value: 'visible', defaultValue: '', share: true },
          { key: 'private', value: '', defaultValue: '', share: false }
        ],
        headers: [{ key: 'X-Header', value: '1', enabled: true }],
        auth: {
          type: 'basic',
          basic: { username: 'admin', password: 'secret' },
          bearer: { token: '' }
        },
        pre_request_script: 'pre script',
        post_request_script: 'post script',
        folders: [],
        requests: [
          {
            name: 'Get Users',
            method: 'GET',
            url: 'https://api.example.com/users',
            headers: [{ key: 'X-Test', value: '1', enabled: true }],
            params: [{ key: 'q', value: 'search', enabled: true }],
            auth: defaultAuth(),
            body: '',
            body_type: 'none',
            pre_request_script: 'req pre',
            post_request_script: 'req post',
            comment: 'Request notes',
            sort_order: 0,
            folder_name: null
          }
        ]
      });
      expect(exported.requests[0]).not.toHaveProperty('id');
      expect(exported.requests[0]).not.toHaveProperty('collection_id');
    });

    it('importCollectionData creates collection and requests', async () => {
      const { db } = await createTestDb();
      const payload: CollectionExport = {
        harborclientVersion: 1,
        harborclientExport: 'collection',
        name: 'Imported',
        variables: [
          { key: 'baseUrl', value: 'https://example.com', defaultValue: '', share: true }
        ],
        headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
        pre_request_script: 'collection pre',
        post_request_script: 'collection post',
        requests: [
          {
            name: 'Health',
            method: 'GET',
            url: 'https://example.com/health',
            headers: [],
            params: [],
            body: '',
            body_type: 'none',
            pre_request_script: '',
            post_request_script: '',
            comment: '',
            sort_order: 0
          }
        ]
      };

      const imported = await db.importCollectionData(payload);

      expect(imported.name).toBe('Imported');
      expect(imported.variables).toEqual(payload.variables);
      expect(await db.listCollections()).toHaveLength(1);
      expect(await db.listRequests(imported.id)).toHaveLength(1);
      expect((await db.listRequests(imported.id))[0]?.name).toBe('Health');
    });

    it('importCollectionData rejects null payload, unsupported version, blank name, and invalid request fields', async () => {
      const { db } = await createTestDb();

      await expect(db.importCollectionData(null)).rejects.toThrow(
        'Invalid collection file: expected a JSON object'
      );
      await expect(
        db.importCollectionData({
          harborclientVersion: 3,
          harborclientExport: 'collection',
          name: 'Bad',
          requests: []
        })
      ).rejects.toThrow('Invalid collection file: unsupported format version');
      await expect(
        db.importCollectionData({
          harborclientVersion: 1,
          harborclientExport: 'collection',
          name: '   ',
          requests: []
        })
      ).rejects.toThrow('Invalid collection file: collection name is required');
      await expect(
        db.importCollectionData({
          harborclientVersion: 1,
          harborclientExport: 'collection',
          name: 'Bad Request',
          requests: [{ name: 'X', method: 'INVALID', body_type: 'none' }]
        })
      ).rejects.toThrow('Invalid collection file: request 1 has an invalid method');
      await expect(
        db.importCollectionData({
          harborclientVersion: 1,
          harborclientExport: 'collection',
          name: 'Bad Body',
          requests: [{ name: 'X', method: 'GET', body_type: 'xml' }]
        })
      ).rejects.toThrow('Invalid collection file: request 1 has an invalid body type');
      await expect(
        db.importCollectionData({
          harborclientVersion: 2,
          harborclientExport: 'collection',
          name: 'Duplicate Folders',
          folders: [
            { name: 'API', sort_order: 0 },
            { name: 'API', sort_order: 1 }
          ],
          requests: []
        })
      ).rejects.toThrow('Invalid collection file: folder 2 has a duplicate name');
    });
  });

  describe(`${label} folders`, () => {
    it('createFolder and listFolders return ordered folders', async () => {
      const { db } = await createTestDb();
      const collection = await db.createCollection('Folders');

      const alpha = await db.createFolder(collection.id, 'Alpha');
      const beta = await db.createFolder(collection.id, 'Beta');

      expect(alpha.sort_order).toBe(0);
      expect(beta.sort_order).toBe(1);
      expect((await db.listFolders(collection.id)).map((folder) => folder.name)).toEqual([
        'Alpha',
        'Beta'
      ]);
    });

    it('createFolder rejects empty name after trim', async () => {
      const { db } = await createTestDb();
      const collection = await db.createCollection('Folders');
      await expect(db.createFolder(collection.id, '   ')).rejects.toThrow(
        'Folder name is required'
      );
    });

    it('saveRequest stores folder_id and scopes sort_order per folder', async () => {
      const { db } = await createTestDb();
      const collection = await db.createCollection('Folders');
      const folder = await db.createFolder(collection.id, 'API');

      const root = await db.saveRequest(baseRequestInput(collection.id, { name: 'Root' }));
      const inFolder = await db.saveRequest(
        baseRequestInput(collection.id, { name: 'In Folder', folder_id: folder.id })
      );

      expect(root.folder_id).toBeNull();
      expect(root.sort_order).toBe(0);
      expect(inFolder.folder_id).toBe(folder.id);
      expect(inFolder.sort_order).toBe(0);
    });

    it('saveRequest rejects folder_id from another collection', async () => {
      const { db } = await createTestDb();
      const collectionA = await db.createCollection('A');
      const collectionB = await db.createCollection('B');
      const folderInB = await db.createFolder(collectionB.id, 'API');

      await expect(
        db.saveRequest(baseRequestInput(collectionA.id, { folder_id: folderInB.id }))
      ).rejects.toThrow('Folder not found');

      await expect(
        db.saveRequest(baseRequestInput(collectionA.id, { folder_id: 99999 }))
      ).rejects.toThrow('Folder not found');

      const request = await db.saveRequest(baseRequestInput(collectionA.id));
      await expect(
        db.saveRequest({
          ...baseRequestInput(collectionA.id),
          id: request.id,
          folder_id: folderInB.id
        })
      ).rejects.toThrow('Folder not found');
    });

    it('moveRequest moves a request between folder and root', async () => {
      const { db } = await createTestDb();
      const collection = await db.createCollection('Folders');
      const folder = await db.createFolder(collection.id, 'API');
      const request = await db.saveRequest(
        baseRequestInput(collection.id, { name: 'Move Me', folder_id: folder.id })
      );

      await db.moveRequest(request.id, null, 0);

      const requests = await db.listRequests(collection.id);
      const moved = requests.find((item) => item.id === request.id);
      expect(moved?.folder_id).toBeNull();
      expect(moved?.sort_order).toBe(0);
    });

    it('deleteFolder removes folder and contained requests', async () => {
      const { db } = await createTestDb();
      const collection = await db.createCollection('Folders');
      const folder = await db.createFolder(collection.id, 'Temp');
      await db.saveRequest(baseRequestInput(collection.id, { folder_id: folder.id }));

      await db.deleteFolder(folder.id);

      expect(await db.listFolders(collection.id)).toEqual([]);
      expect(await db.listRequests(collection.id)).toEqual([]);
    });

    it('export and import preserve folders', async () => {
      const { db } = await createTestDb();
      const collection = await db.createCollection('Export Folders');
      const folder = await db.createFolder(collection.id, 'Auth');
      await db.saveRequest(
        baseRequestInput(collection.id, { name: 'Login', folder_id: folder.id, method: 'POST' })
      );

      const exported = await db.exportCollectionData(collection.id);
      expect(exported.harborclientVersion).toBe(2);
      expect(exported.harborclientExport).toBe('collection');
      expect(exported.folders).toEqual([{ name: 'Auth', sort_order: 0 }]);
      expect(exported.requests[0]?.folder_name).toBe('Auth');

      const imported = await db.importCollectionData(exported);
      const importedFolders = await db.listFolders(imported.id);
      const importedRequests = await db.listRequests(imported.id);

      expect(importedFolders).toHaveLength(1);
      expect(importedRequests).toHaveLength(1);
      expect(importedRequests[0]?.folder_id).toBe(importedFolders[0]?.id);
    });
  });
}
