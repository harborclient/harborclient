import { MockedFunction, describe, expect, it, vi } from 'vitest';
import {
  type PluginDatabaseBackend,
  createPluginDatabaseApi
} from './runtime/pluginDatabaseApi.js';

/**
 * Builds a mock database backend for unit tests.
 */
function createMockBackend(): {
  [K in keyof PluginDatabaseBackend]: MockedFunction<PluginDatabaseBackend[K]>;
} {
  return {
    query: vi.fn(async () => undefined),
    exec: vi.fn(async () => undefined),
    beginTransaction: vi.fn(async () => 'txn-1'),
    endTransaction: vi.fn(async () => undefined)
  };
}

describe('createPluginDatabaseApi', () => {
  it('forwards get, all, and run with the correct query modes', async () => {
    const backend = createMockBackend();
    backend.query
      .mockResolvedValueOnce({ id: 1 })
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
      .mockResolvedValueOnce({ changes: 1, lastInsertRowid: 42 });

    const db = createPluginDatabaseApi(backend);

    await expect(db.get('SELECT 1', [1])).resolves.toEqual({ id: 1 });
    await expect(db.all('SELECT *', [2])).resolves.toEqual([{ id: 1 }, { id: 2 }]);
    await expect(db.run('INSERT INTO t VALUES (?)', [3])).resolves.toEqual({
      changes: 1,
      lastInsertRowid: 42
    });

    expect(backend.query).toHaveBeenNthCalledWith(1, 'get', 'SELECT 1', [1], undefined);
    expect(backend.query).toHaveBeenNthCalledWith(2, 'all', 'SELECT *', [2], undefined);
    expect(backend.query).toHaveBeenNthCalledWith(
      3,
      'run',
      'INSERT INTO t VALUES (?)',
      [3],
      undefined
    );
  });

  it('forwards exec unchanged', async () => {
    const backend = createMockBackend();
    const db = createPluginDatabaseApi(backend);

    await db.exec('CREATE TABLE t (id INTEGER)');

    expect(backend.exec).toHaveBeenCalledWith('CREATE TABLE t (id INTEGER)');
  });

  it('commits successful transactions and passes txnId to tx helpers', async () => {
    const backend = createMockBackend();
    backend.query.mockResolvedValue({ changes: 1, lastInsertRowid: 1 });

    const db = createPluginDatabaseApi(backend);
    const result = await db.transaction(async (tx) => {
      await tx.run('INSERT INTO t VALUES (?)', [1]);
      await tx.all('SELECT * FROM t');
      return 'done';
    });

    expect(result).toBe('done');
    expect(backend.beginTransaction).toHaveBeenCalledTimes(1);
    expect(backend.endTransaction).toHaveBeenCalledWith('txn-1', 'commit');
    expect(backend.query).toHaveBeenCalledWith('run', 'INSERT INTO t VALUES (?)', [1], 'txn-1');
    expect(backend.query).toHaveBeenCalledWith('all', 'SELECT * FROM t', undefined, 'txn-1');
  });

  it('rolls back failed transactions', async () => {
    const backend = createMockBackend();
    const db = createPluginDatabaseApi(backend);
    const boom = new Error('boom');

    await expect(
      db.transaction(async (tx) => {
        await tx.run('INSERT INTO t VALUES (?)', [1]);
        throw boom;
      })
    ).rejects.toThrow(boom);

    expect(backend.beginTransaction).toHaveBeenCalledTimes(1);
    expect(backend.endTransaction).toHaveBeenCalledWith('txn-1', 'rollback');
    expect(backend.endTransaction).not.toHaveBeenCalledWith('txn-1', 'commit');
  });
});
