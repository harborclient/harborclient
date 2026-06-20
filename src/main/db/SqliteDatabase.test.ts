import Database from 'better-sqlite3';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SqliteSettings } from '#/shared/types';
import { SqliteDatabase } from '#/main/db/SqliteDatabase';
import {
  baseRequestInput,
  runIdatabaseContractSuite,
  type TestDbHandle
} from '#/test/idatabaseContract';
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

async function createTestDb(): Promise<TestDbHandle & { tmpDir: string }> {
  const tmpDir = mkdtempSync(join(tmpdir(), 'harborclient-db-'));
  const db = new SqliteDatabase(tmpDir, DEFAULT_TEST_SETTINGS);
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

describeSqlite('SqliteDatabase contract', () => {
  runIdatabaseContractSuite('SqliteDatabase', createTestDb);
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
