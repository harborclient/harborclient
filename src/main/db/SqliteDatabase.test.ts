import Database from 'better-sqlite3';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CollectionExport, SaveRequestInput, SqliteSettings } from '#/shared/types';
import { SqliteDatabase } from '#/main/db/SqliteDatabase';
import { describeSqlite } from '#/test/nativeModules';

const DEFAULT_TEST_SETTINGS: SqliteSettings = {
  dbFilename: 'harborclient.db',
  legacyDbFilename: 'harbor-client.db',
  legacyUserDataDir: 'harbor-client'
};

const TEST_APP_DATA = join(tmpdir(), 'harborclient-test-appdata');

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'appData') return TEST_APP_DATA;
      return tmpdir();
    })
  }
}));

const cleanups: Array<() => void | Promise<void>> = [];

async function createTestDb(): Promise<{ db: SqliteDatabase; tmpDir: string }> {
  const tmpDir = mkdtempSync(join(tmpdir(), 'harborclient-db-'));
  const db = new SqliteDatabase(tmpDir, DEFAULT_TEST_SETTINGS);
  await db.init();
  cleanups.push(async () => {
    await db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });
  return { db, tmpDir };
}

function baseRequestInput(
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
    ...overrides
  };
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
  if (existsSync(TEST_APP_DATA)) {
    rmSync(TEST_APP_DATA, { recursive: true, force: true });
  }
});

describe('SqliteDatabase lifecycle', () => {
  it('throws when accessed before init', async () => {
    const db = new SqliteDatabase(tmpdir(), DEFAULT_TEST_SETTINGS);
    await expect(db.listCollections()).rejects.toThrow('Database not initialized');
  });
});

describeSqlite('SqliteDatabase lifecycle with sqlite', () => {
  it('init is idempotent', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'harborclient-db-'));
    const db = new SqliteDatabase(tmpDir, DEFAULT_TEST_SETTINGS);
    cleanups.push(async () => {
      await db.close();
      rmSync(tmpDir, { recursive: true, force: true });
    });

    await db.init();
    await expect(db.init()).resolves.toBeUndefined();
    expect(await db.listCollections()).toEqual([]);
  });

  it('close allows subsequent init on a new directory', async () => {
    const firstDir = mkdtempSync(join(tmpdir(), 'harborclient-db-'));
    const secondDir = mkdtempSync(join(tmpdir(), 'harborclient-db-'));
    const db = new SqliteDatabase(firstDir, DEFAULT_TEST_SETTINGS);

    await db.init();
    await db.createCollection('First');
    await db.close();

    const reopened = new SqliteDatabase(secondDir, DEFAULT_TEST_SETTINGS);
    cleanups.push(async () => {
      await reopened.close();
      rmSync(firstDir, { recursive: true, force: true });
      rmSync(secondDir, { recursive: true, force: true });
    });

    await reopened.init();
    expect(await reopened.listCollections()).toEqual([]);
    expect((await reopened.createCollection('Second')).name).toBe('Second');
  });
});

describeSqlite('SqliteDatabase collections', () => {
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
    expect(collection.pre_request_script).toBe('');
    expect(collection.post_request_script).toBe('');
    expect(collection.created_at).toEqual(expect.any(String));
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
      'console.log("post");'
    );

    expect(updated).toMatchObject({
      id: created.id,
      name: 'Updated',
      variables: [{ key: 'host', value: 'api.example.com', defaultValue: '', share: true }],
      headers: [{ key: 'Authorization', value: 'Bearer token', enabled: true }],
      pre_request_script: 'console.log("pre");',
      post_request_script: 'console.log("post");'
    });
    expect((await db.listCollections())[0]).toEqual(updated);
  });

  it('updateCollection throws when collection is missing', async () => {
    const { db } = await createTestDb();
    await expect(db.updateCollection(999, 'Missing', [], [], '', '')).rejects.toThrow(
      'Collection not found'
    );
  });

  it('deleteCollection removes the collection', async () => {
    const { db } = await createTestDb();
    const collection = await db.createCollection('To Delete');
    await db.deleteCollection(collection.id);
    expect(await db.listCollections()).toEqual([]);
  });
});

describeSqlite('SqliteDatabase requests', () => {
  it('saveRequest inserts with auto-incremented sort_order', async () => {
    const { db } = await createTestDb();
    const collection = await db.createCollection('Requests');

    const first = await db.saveRequest(baseRequestInput(collection.id, { name: 'First' }));
    const second = await db.saveRequest(baseRequestInput(collection.id, { name: 'Second' }));

    expect(first.sort_order).toBe(0);
    expect(second.sort_order).toBe(1);
    expect(first.id).not.toBe(second.id);
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

describeSqlite('SqliteDatabase settings', () => {
  it('getSetting returns undefined when unset', async () => {
    const { db } = await createTestDb();
    expect(await db.getSetting('theme')).toBeUndefined();
  });

  it('setSetting and getSetting round-trip and overwrite', async () => {
    const { db } = await createTestDb();

    await db.setSetting('theme', 'dark');
    expect(await db.getSetting('theme')).toBe('dark');

    await db.setSetting('theme', 'light');
    expect(await db.getSetting('theme')).toBe('light');
  });
});

describeSqlite('SqliteDatabase import and export', () => {
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
      'post script'
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
      formatVersion: 2,
      name: 'Export Me',
      variables: [
        { key: 'shared', value: 'visible', defaultValue: '', share: true },
        { key: 'private', value: '', defaultValue: '', share: false }
      ],
      headers: [{ key: 'X-Header', value: '1', enabled: true }],
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
      formatVersion: 1,
      name: 'Imported',
      variables: [{ key: 'baseUrl', value: 'https://example.com', defaultValue: '', share: true }],
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

  it('importCollectionData rejects invalid payloads', async () => {
    const { db } = await createTestDb();

    await expect(db.importCollectionData(null)).rejects.toThrow(
      'Invalid collection file: expected a JSON object'
    );
    await expect(
      db.importCollectionData({ formatVersion: 3, name: 'Bad', requests: [] })
    ).rejects.toThrow('Invalid collection file: unsupported format version');
    await expect(
      db.importCollectionData({ formatVersion: 1, name: '   ', requests: [] })
    ).rejects.toThrow('Invalid collection file: collection name is required');
    await expect(
      db.importCollectionData({
        formatVersion: 1,
        name: 'Bad Request',
        requests: [{ name: 'X', method: 'INVALID', body_type: 'none' }]
      })
    ).rejects.toThrow('Invalid collection file: request 1 has an invalid method');
    await expect(
      db.importCollectionData({
        formatVersion: 1,
        name: 'Bad Body',
        requests: [{ name: 'X', method: 'GET', body_type: 'xml' }]
      })
    ).rejects.toThrow('Invalid collection file: request 1 has an invalid body type');
  });
});

describeSqlite('SqliteDatabase folders', () => {
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
    expect(exported.formatVersion).toBe(2);
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

describeSqlite('SqliteDatabase legacy migration', () => {
  it('copies legacy harbor-client.db from appData when harborclient.db is missing', async () => {
    const legacyDir = join(TEST_APP_DATA, 'harbor-client');
    mkdirSync(legacyDir, { recursive: true });
    const legacyPath = join(legacyDir, 'harbor-client.db');

    const legacyDb = new Database(legacyPath);
    legacyDb.exec(`
      CREATE TABLE collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        variables TEXT NOT NULL DEFAULT '[]',
        headers TEXT NOT NULL DEFAULT '[]',
        pre_request_script TEXT NOT NULL DEFAULT '',
        post_request_script TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        method TEXT NOT NULL DEFAULT 'GET',
        url TEXT NOT NULL DEFAULT '',
        headers TEXT NOT NULL DEFAULT '[]',
        params TEXT NOT NULL DEFAULT '[]',
        body TEXT NOT NULL DEFAULT '',
        body_type TEXT NOT NULL DEFAULT 'none',
        pre_request_script TEXT NOT NULL DEFAULT '',
        post_request_script TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
      );
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    legacyDb.prepare('INSERT INTO collections (name) VALUES (?)').run('Legacy Collection');
    legacyDb.close();

    const userDataDir = mkdtempSync(join(tmpdir(), 'harborclient-db-'));
    const db = new SqliteDatabase(userDataDir, DEFAULT_TEST_SETTINGS);
    cleanups.push(async () => {
      await db.close();
      rmSync(userDataDir, { recursive: true, force: true });
    });

    await db.init();

    expect(existsSync(join(userDataDir, 'harborclient.db'))).toBe(true);
    expect((await db.listCollections()).map((c) => c.name)).toEqual(['Legacy Collection']);
  });

  it('copies legacy harbor-client.db from userDataPath when present', async () => {
    const userDataDir = mkdtempSync(join(tmpdir(), 'harborclient-db-'));
    const legacyPath = join(userDataDir, 'harbor-client.db');

    const legacyDb = new Database(legacyPath);
    legacyDb.exec(`
      CREATE TABLE collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        variables TEXT NOT NULL DEFAULT '[]',
        headers TEXT NOT NULL DEFAULT '[]',
        pre_request_script TEXT NOT NULL DEFAULT '',
        post_request_script TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        method TEXT NOT NULL DEFAULT 'GET',
        url TEXT NOT NULL DEFAULT '',
        headers TEXT NOT NULL DEFAULT '[]',
        params TEXT NOT NULL DEFAULT '[]',
        body TEXT NOT NULL DEFAULT '',
        body_type TEXT NOT NULL DEFAULT 'none',
        pre_request_script TEXT NOT NULL DEFAULT '',
        post_request_script TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
      );
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    legacyDb.prepare('INSERT INTO collections (name) VALUES (?)').run('Local Legacy');
    legacyDb.close();

    const db = new SqliteDatabase(userDataDir, DEFAULT_TEST_SETTINGS);
    cleanups.push(async () => {
      await db.close();
      rmSync(userDataDir, { recursive: true, force: true });
    });

    await db.init();

    expect(existsSync(join(userDataDir, 'harborclient.db'))).toBe(true);
    expect((await db.listCollections()).map((c) => c.name)).toEqual(['Local Legacy']);
  });

  it('adds comment column to legacy requests table on init', async () => {
    const userDataDir = mkdtempSync(join(tmpdir(), 'harborclient-db-'));
    const dbPath = join(userDataDir, 'harborclient.db');

    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        variables TEXT NOT NULL DEFAULT '[]',
        headers TEXT NOT NULL DEFAULT '[]',
        pre_request_script TEXT NOT NULL DEFAULT '',
        post_request_script TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        method TEXT NOT NULL DEFAULT 'GET',
        url TEXT NOT NULL DEFAULT '',
        headers TEXT NOT NULL DEFAULT '[]',
        params TEXT NOT NULL DEFAULT '[]',
        body TEXT NOT NULL DEFAULT '',
        body_type TEXT NOT NULL DEFAULT 'none',
        pre_request_script TEXT NOT NULL DEFAULT '',
        post_request_script TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
      );
    `);
    legacyDb.close();

    const db = new SqliteDatabase(userDataDir, DEFAULT_TEST_SETTINGS);
    cleanups.push(async () => {
      await db.close();
      rmSync(userDataDir, { recursive: true, force: true });
    });

    await db.init();

    const collection = await db.createCollection('Migrated');
    const saved = await db.saveRequest(
      baseRequestInput(collection.id, { comment: 'Migrated comment' })
    );
    expect(saved.comment).toBe('Migrated comment');
  });
});
