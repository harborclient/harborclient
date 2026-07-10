import Database from 'better-sqlite3';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultAuth } from '#/shared/auth';
import { createInlineScriptRef } from '#/shared/scriptRefs';
import type { SqliteSettings } from '#/shared/types';
import { SqliteStorage } from '#/main/storage/SqliteStorage';
import {
  baseRequestInput,
  runIstorageContractSuite,
  type TestDbHandle
} from '#/test/istorageContract';
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

/**
 * Creates an isolated SQLite database instance for unit tests.
 *
 * @returns Configured test database handle and temp directory path.
 */
async function createTestDb(): Promise<TestDbHandle & { tmpDir: string }> {
  const tmpDir = mkdtempSync(join(tmpdir(), 'harborclient-db-'));
  const db = new SqliteStorage(tmpDir, DEFAULT_TEST_SETTINGS);
  await db.init();
  cleanups.push(async () => {
    await db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });
  return { db, tmpDir };
}

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
  if (existsSync(TEST_APP_DATA)) {
    rmSync(TEST_APP_DATA, { recursive: true, force: true });
  }
});

describeSqlite('SqliteStorage script arrays', () => {
  it('round-trips multiple pre-request script references on save and list', async () => {
    const { db } = await createTestDb();
    const collection = await db.createCollection('Scripts');
    const first = createInlineScriptRef('console.log("one");', 'First');
    const second = createInlineScriptRef('', 'Unnamed script...');

    const saved = await db.saveRequest({
      ...baseRequestInput(collection.id, { name: 'Scripted' }),
      pre_request_script: 'console.log("one");',
      pre_request_scripts: [first, second]
    });

    expect(saved.pre_request_scripts).toHaveLength(2);
    expect(saved.pre_request_scripts.map((script) => script.name)).toEqual([
      'First',
      'Unnamed script...'
    ]);

    const listed = await db.listRequests(collection.id);
    expect(listed[0]?.pre_request_scripts).toHaveLength(2);
    expect(listed[0]?.pre_request_scripts.map((script) => script.name)).toEqual([
      'First',
      'Unnamed script...'
    ]);
  });

  it('round-trips expanded flags on script references', async () => {
    const { db } = await createTestDb();
    const collection = await db.createCollection('Scripts');
    const expanded = { ...createInlineScriptRef('console.log("open");'), expanded: true };
    const collapsed = { ...createInlineScriptRef('console.log("shut");'), expanded: false };

    const saved = await db.saveRequest({
      ...baseRequestInput(collection.id, { name: 'Expansion' }),
      pre_request_scripts: [expanded, collapsed]
    });

    expect(saved.pre_request_scripts).toEqual([
      expect.objectContaining({ expanded: true }),
      expect.objectContaining({ expanded: false })
    ]);

    const listed = await db.listRequests(collection.id);
    expect(listed[0]?.pre_request_scripts).toEqual([
      expect.objectContaining({ expanded: true }),
      expect.objectContaining({ expanded: false })
    ]);
  });
});

describe('SqliteStorage lifecycle', () => {
  it('throws when accessed before init', async () => {
    const db = new SqliteStorage(tmpdir(), DEFAULT_TEST_SETTINGS);
    await expect(db.listCollections()).rejects.toThrow('Database not initialized');
  });
});

describeSqlite('SqliteStorage lifecycle with sqlite', () => {
  it('init is idempotent', async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'harborclient-db-'));
    const db = new SqliteStorage(tmpDir, DEFAULT_TEST_SETTINGS);
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
    const db = new SqliteStorage(firstDir, DEFAULT_TEST_SETTINGS);

    await db.init();
    await db.createCollection('First');
    await db.close();

    const reopened = new SqliteStorage(secondDir, DEFAULT_TEST_SETTINGS);
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

describeSqlite('SqliteStorage uuid import', () => {
  it('round-trips collection and request uuids through export and import', async () => {
    const { db } = await createTestDb();
    const collection = await db.createCollection('Round Trip');
    await db.saveRequest(baseRequestInput(collection.id, { name: 'Ping' }));

    const exported = await db.exportCollectionData(collection.id);
    const imported = await db.importCollectionData(exported);

    expect(imported.uuid).toBe(exported.uuid);
    const importedRequests = await db.listRequests(imported.id);
    expect(importedRequests[0]?.uuid).toBe(exported.requests[0]?.uuid);
  });

  it('finds collections and requests by portable uuid', async () => {
    const { db } = await createTestDb();
    const collection = await db.createCollection('Lookup');
    const request = await db.saveRequest(baseRequestInput(collection.id, { name: 'Item' }));

    expect(await db.findCollectionByUuid(collection.uuid)).toMatchObject({
      id: collection.id,
      uuid: collection.uuid
    });
    expect(await db.findRequestByUuid(collection.id, request.uuid)).toMatchObject({
      id: request.id,
      uuid: request.uuid
    });
  });

  it('updateCollectionFromImport upserts requests by uuid without deleting extras', async () => {
    const { db } = await createTestDb();
    const collection = await db.createCollection('Upsert');
    const kept = await db.saveRequest(baseRequestInput(collection.id, { name: 'Kept' }));
    const updated = await db.saveRequest(baseRequestInput(collection.id, { name: 'Old Name' }));

    const exportData = await db.exportCollectionData(collection.id);
    const payload: typeof exportData = {
      ...exportData,
      name: 'Upsert Renamed',
      requests: exportData.requests.map((row) =>
        row.uuid === updated.uuid ? { ...row, name: 'New Name' } : row
      )
    };

    const result = await db.updateCollectionFromImport(collection.id, payload);
    const requests = await db.listRequests(collection.id);

    expect(result.name).toBe('Upsert Renamed');
    expect(requests).toHaveLength(2);
    expect(requests.find((item) => item.uuid === kept.uuid)?.name).toBe('Kept');
    expect(requests.find((item) => item.uuid === updated.uuid)?.name).toBe('New Name');
  });

  it('round-trips folder uuids through export and import', async () => {
    const { db } = await createTestDb();
    const collection = await db.createCollection('Folder Round Trip');
    const folder = await db.createFolder(collection.id, 'Auth');
    await db.saveRequest(
      baseRequestInput(collection.id, { name: 'Login', folder_id: folder.id, method: 'POST' })
    );

    const exported = await db.exportCollectionData(collection.id);
    expect(exported.folders?.[0]?.uuid).toBe(folder.uuid);
    expect(exported.requests[0]?.folder_uuid).toBe(folder.uuid);

    const imported = await db.importCollectionData(exported);
    const importedFolders = await db.listFolders(imported.id);
    expect(importedFolders[0]?.uuid).toBe(folder.uuid);
  });

  it('round-trips folder settings through export and import', async () => {
    const { db } = await createTestDb();
    const collection = await db.createCollection('Folder Settings');
    const folder = await db.createFolder(collection.id, 'Auth');
    const variables = [
      { key: 'token', value: 'secret', defaultValue: 'fallback', share: false },
      { key: 'publicId', value: 'visible', defaultValue: '', share: true }
    ];
    const headers = [{ key: 'X-Test', value: '1', enabled: true }];
    await db.updateFolder(folder.id, 'Auth', variables, headers, '', '', defaultAuth(), [], []);

    const exported = await db.exportCollectionData(collection.id);
    expect(exported.folders?.[0]?.variables).toEqual([
      { key: 'token', value: '', defaultValue: 'fallback', share: false },
      { key: 'publicId', value: 'visible', defaultValue: '', share: true }
    ]);

    const imported = await db.importCollectionData(exported);
    const importedFolders = await db.listFolders(imported.id);

    expect(importedFolders).toHaveLength(1);
    expect(importedFolders[0]?.variables).toEqual(exported.folders?.[0]?.variables);
    expect(importedFolders[0]?.headers).toEqual(headers);
  });

  it('updateCollectionFromImport reuses folder by uuid when name changes', async () => {
    const { db } = await createTestDb();
    const collection = await db.createCollection('Folder Upsert');
    const folder = await db.createFolder(collection.id, 'Old Name');
    await db.saveRequest(
      baseRequestInput(collection.id, { name: 'In Folder', folder_id: folder.id })
    );

    const exportData = await db.exportCollectionData(collection.id);
    const payload: typeof exportData = {
      ...exportData,
      folders: exportData.folders?.map((row) =>
        row.uuid === folder.uuid ? { ...row, name: 'Renamed Folder' } : row
      ),
      requests: exportData.requests.map((row) =>
        row.folder_uuid === folder.uuid ? { ...row, folder_name: 'Renamed Folder' } : row
      )
    };

    await db.updateCollectionFromImport(collection.id, payload);
    const folders = await db.listFolders(collection.id);

    expect(folders).toHaveLength(1);
    expect(folders[0]?.id).toBe(folder.id);
    expect(folders[0]?.uuid).toBe(folder.uuid);
    expect(folders[0]?.name).toBe('Renamed Folder');
  });

  it('links imported requests via folder_uuid when folder_name differs', async () => {
    const { db } = await createTestDb();
    const collection = await db.createCollection('Folder Uuid Link');
    const folder = await db.createFolder(collection.id, 'Auth');
    await db.saveRequest(baseRequestInput(collection.id, { name: 'Login', folder_id: folder.id }));

    const exportData = await db.exportCollectionData(collection.id);
    const payload: typeof exportData = {
      ...exportData,
      requests: exportData.requests.map((row) => ({
        ...row,
        folder_name: 'Wrong Name',
        folder_uuid: folder.uuid
      }))
    };

    const imported = await db.importCollectionData(payload);
    const importedFolders = await db.listFolders(imported.id);
    const importedRequests = await db.listRequests(imported.id);

    expect(importedRequests[0]?.folder_id).toBe(importedFolders[0]?.id);
  });
});

describeSqlite('SqliteStorage contract', () => {
  runIstorageContractSuite('SqliteStorage', createTestDb);
});

describeSqlite('SqliteStorage legacy migration', () => {
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
    const db = new SqliteStorage(userDataDir, DEFAULT_TEST_SETTINGS);
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

    const db = new SqliteStorage(userDataDir, DEFAULT_TEST_SETTINGS);
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

    const db = new SqliteStorage(userDataDir, DEFAULT_TEST_SETTINGS);
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

  it('adds tags column to legacy requests table on init', async () => {
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
        comment TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
      );
    `);
    legacyDb.close();

    const db = new SqliteStorage(userDataDir, DEFAULT_TEST_SETTINGS);
    cleanups.push(async () => {
      await db.close();
      rmSync(userDataDir, { recursive: true, force: true });
    });

    await db.init();

    const collection = await db.createCollection('Tagged');
    const saved = await db.saveRequest(baseRequestInput(collection.id, { tags: 'api, staging' }));
    expect(saved.tags).toBe('api, staging');
  });
});
