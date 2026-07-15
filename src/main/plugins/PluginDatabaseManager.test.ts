import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertSafeExecSql,
  PluginDatabaseManager,
  PLUGIN_DATABASES_DIR
} from './PluginDatabaseManager';

const cleanups: Array<() => void> = [];

/**
 * Creates an isolated userData directory for plugin database tests.
 */
function createTempUserData(): string {
  const rootDir = mkdtempSync(join(tmpdir(), 'hc-plugin-db-'));
  cleanups.push(() => rmSync(rootDir, { recursive: true, force: true }));
  return rootDir;
}

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe('PluginDatabaseManager', () => {
  it('isolates database files by plugin id', async () => {
    const userDataPath = createTempUserData();
    const manager = new PluginDatabaseManager(userDataPath);

    await manager.exec('com.example.one', 'CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');
    await manager.run('com.example.one', 'INSERT INTO items (name) VALUES (?)', ['alpha']);
    await manager.exec('com.example.two', 'CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)');
    await manager.run('com.example.two', 'INSERT INTO items (name) VALUES (?)', ['beta']);

    expect(await manager.all('com.example.one', 'SELECT name FROM items')).toEqual([
      { name: 'alpha' }
    ]);
    expect(await manager.all('com.example.two', 'SELECT name FROM items')).toEqual([
      { name: 'beta' }
    ]);
    expect(existsSync(join(userDataPath, PLUGIN_DATABASES_DIR, 'com.example.one.sqlite'))).toBe(
      true
    );
    expect(existsSync(join(userDataPath, PLUGIN_DATABASES_DIR, 'com.example.two.sqlite'))).toBe(
      true
    );
  });

  it('supports parameterized get/all/run queries', async () => {
    const manager = new PluginDatabaseManager(createTempUserData());
    await manager.exec(
      'com.example.test',
      'CREATE TABLE counters (id INTEGER PRIMARY KEY AUTOINCREMENT, value INTEGER NOT NULL)'
    );

    const insert = await manager.run(
      'com.example.test',
      'INSERT INTO counters (value) VALUES (?)',
      [7]
    );
    expect(insert.changes).toBe(1);
    expect(insert.lastInsertRowid).toBe(1);

    expect(
      await manager.get('com.example.test', 'SELECT value FROM counters WHERE id = ?', [1])
    ).toEqual({
      value: 7
    });
    expect(await manager.all('com.example.test', 'SELECT value FROM counters')).toEqual([
      { value: 7 }
    ]);
  });

  it('commits and rolls back transactions', async () => {
    const manager = new PluginDatabaseManager(createTempUserData());
    await manager.exec(
      'com.example.test',
      'CREATE TABLE accounts (id INTEGER PRIMARY KEY, balance INTEGER NOT NULL)'
    );
    await manager.run(
      'com.example.test',
      'INSERT INTO accounts (id, balance) VALUES (?, ?)',
      [1, 100]
    );

    const txnId = await manager.beginTransaction('com.example.test');
    await manager.run(
      'com.example.test',
      'UPDATE accounts SET balance = balance - ? WHERE id = ?',
      [25, 1],
      txnId
    );
    await manager.endTransaction('com.example.test', txnId, 'commit');

    expect(
      await manager.get('com.example.test', 'SELECT balance FROM accounts WHERE id = ?', [1])
    ).toEqual({
      balance: 75
    });

    const rollbackTxnId = await manager.beginTransaction('com.example.test');
    await manager.run(
      'com.example.test',
      'UPDATE accounts SET balance = balance - ? WHERE id = ?',
      [25, 1],
      rollbackTxnId
    );
    await manager.endTransaction('com.example.test', rollbackTxnId, 'rollback');

    expect(
      await manager.get('com.example.test', 'SELECT balance FROM accounts WHERE id = ?', [1])
    ).toEqual({
      balance: 75
    });
  });

  it('rejects ATTACH in exec scripts', () => {
    expect(() => assertSafeExecSql('ATTACH DATABASE "/tmp/evil.db" AS evil')).toThrow(
      /ATTACH, DETACH, and load_extension/
    );
  });

  it('deletes database files and sidecars', async () => {
    const userDataPath = createTempUserData();
    const manager = new PluginDatabaseManager(userDataPath);
    await manager.exec('com.example.test', 'CREATE TABLE t (id INTEGER PRIMARY KEY)');
    await manager.run('com.example.test', 'INSERT INTO t DEFAULT VALUES');

    const basePath = join(userDataPath, PLUGIN_DATABASES_DIR, 'com.example.test.sqlite');
    expect(existsSync(basePath)).toBe(true);

    manager.deleteDatabase('com.example.test');
    expect(existsSync(basePath)).toBe(false);
    expect(existsSync(`${basePath}-wal`)).toBe(false);
    expect(existsSync(`${basePath}-shm`)).toBe(false);
  });
});
