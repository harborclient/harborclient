import type { UtilityProcess } from 'electron';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  utilityProcess: {
    fork: vi.fn(() => ({
      on: vi.fn(),
      postMessage: vi.fn(),
      kill: vi.fn()
    }))
  }
}));

vi.mock('esbuild', () => ({
  transformSync: vi.fn(() => ({ code: 'module.exports = {};' }))
}));

/**
 * Builds a mock utility process that captures postMessage replies.
 */
function createMockChild(): UtilityProcess & { replies: unknown[] } {
  const replies: unknown[] = [];
  return {
    replies,
    postMessage: vi.fn((reply: unknown) => {
      replies.push(reply);
    }),
    on: vi.fn(),
    kill: vi.fn()
  } as unknown as UtilityProcess & { replies: unknown[] };
}

describe('pluginRunnerHost shutdown', () => {
  it('rejects new work after disposePluginRunner is called', async () => {
    vi.resetModules();
    const { activatePluginMain, disposePluginRunner, PluginRunnerUnavailableError } =
      await import('#/main/plugins/pluginRunnerHost');

    disposePluginRunner();

    await expect(activatePluginMain('test.plugin', 'export {}', [])).rejects.toBeInstanceOf(
      PluginRunnerUnavailableError
    );
  });

  it('rejects in-flight work with PluginRunnerUnavailableError when the runner exits during app quit', async () => {
    vi.resetModules();
    let exitHandler: (() => void) | undefined;
    vi.mocked((await import('electron')).utilityProcess.fork).mockImplementationOnce(() => {
      const child = {
        on: vi.fn((event: string, handler: () => void) => {
          if (event === 'exit') {
            exitHandler = handler;
          }
        }),
        postMessage: vi.fn(),
        kill: vi.fn()
      };
      return child as never;
    });

    const { activatePluginMain, markPluginRunnerAppQuitting, PluginRunnerUnavailableError } =
      await import('#/main/plugins/pluginRunnerHost');

    const pending = activatePluginMain('test.plugin', 'export {}', []);
    markPluginRunnerAppQuitting();
    exitHandler?.();

    await expect(pending).rejects.toBeInstanceOf(PluginRunnerUnavailableError);
  });
});

describe('pluginRunnerHost storage handlers', () => {
  it('forwards storageGet to registered callbacks and replies with the result', async () => {
    vi.resetModules();
    const { handleChildStorageGet, setPluginStorageAccess } =
      await import('#/main/plugins/pluginRunnerHost');
    const child = createMockChild();

    setPluginStorageAccess({
      get: (pluginId, key) => {
        expect(pluginId).toBe('com.example.test');
        expect(key).toBe('state');
        return { count: 2 };
      },
      set: () => undefined
    });

    handleChildStorageGet(child, {
      type: 'storageGet',
      id: 7,
      pluginId: 'com.example.test',
      key: 'state'
    });

    expect(child.replies).toEqual([{ id: 7, ok: true, result: { count: 2 } }]);
  });

  it('forwards storageSet to registered callbacks and replies with success', async () => {
    vi.resetModules();
    const { handleChildStorageSet, setPluginStorageAccess } =
      await import('#/main/plugins/pluginRunnerHost');
    const child = createMockChild();
    const stored: Array<{ pluginId: string; key: string; value: unknown }> = [];

    setPluginStorageAccess({
      get: () => undefined,
      set: (pluginId, key, value) => {
        stored.push({ pluginId, key, value });
      }
    });

    handleChildStorageSet(child, {
      type: 'storageSet',
      id: 8,
      pluginId: 'com.example.test',
      key: 'enabled',
      value: true
    });

    expect(stored).toEqual([{ pluginId: 'com.example.test', key: 'enabled', value: true }]);
    expect(child.replies).toEqual([{ id: 8, ok: true }]);
  });

  it('returns an error reply when storage access is not configured', async () => {
    vi.resetModules();
    const { handleChildStorageGet } = await import('#/main/plugins/pluginRunnerHost');
    const child = createMockChild();

    handleChildStorageGet(child, {
      type: 'storageGet',
      id: 9,
      pluginId: 'com.example.test',
      key: 'state'
    });

    expect(child.replies).toEqual([
      { id: 9, ok: false, error: 'Plugin storage access is not configured.' }
    ]);
  });

  it('returns an error reply when storage callbacks throw', async () => {
    vi.resetModules();
    const { handleChildStorageSet, setPluginStorageAccess } =
      await import('#/main/plugins/pluginRunnerHost');
    const child = createMockChild();

    setPluginStorageAccess({
      get: () => undefined,
      set: () => {
        throw new Error('Plugin com.example.test storage key "state" contains invalid JSON.');
      }
    });

    handleChildStorageSet(child, {
      type: 'storageSet',
      id: 10,
      pluginId: 'com.example.test',
      key: 'state',
      value: '{not json'
    });

    expect(child.replies).toEqual([
      {
        id: 10,
        ok: false,
        error: 'Plugin com.example.test storage key "state" contains invalid JSON.'
      }
    ]);
  });
});

describe('pluginRunnerHost database handlers', () => {
  it('forwards databaseQuery to registered callbacks and replies with the result', async () => {
    vi.resetModules();
    const { handleChildDatabaseQuery, setPluginDatabaseAccess } =
      await import('#/main/plugins/pluginRunnerHost');
    const child = createMockChild();

    setPluginDatabaseAccess({
      get: async (pluginId, sql) => {
        expect(pluginId).toBe('com.example.test');
        expect(sql).toBe('SELECT value FROM items WHERE id = ?');
        return { value: 3 };
      },
      all: async () => [],
      run: async () => ({ changes: 0, lastInsertRowid: 0 }),
      exec: async () => undefined,
      beginTransaction: async () => '1',
      endTransaction: async () => undefined
    });

    await handleChildDatabaseQuery(child, {
      type: 'databaseQuery',
      id: 11,
      pluginId: 'com.example.test',
      mode: 'get',
      sql: 'SELECT value FROM items WHERE id = ?',
      params: [1]
    });

    expect(child.replies).toEqual([{ id: 11, ok: true, result: { value: 3 } }]);
  });

  it('forwards databaseTxBegin and databaseTxEnd to registered callbacks', async () => {
    vi.resetModules();
    const { handleChildDatabaseTxBegin, handleChildDatabaseTxEnd, setPluginDatabaseAccess } =
      await import('#/main/plugins/pluginRunnerHost');
    const child = createMockChild();
    const events: string[] = [];

    setPluginDatabaseAccess({
      get: async () => undefined,
      all: async () => [],
      run: async () => ({ changes: 0, lastInsertRowid: 0 }),
      exec: async () => undefined,
      beginTransaction: async (pluginId) => {
        events.push(`begin:${pluginId}`);
        return 'txn-1';
      },
      endTransaction: async (pluginId, txnId, action) => {
        events.push(`end:${pluginId}:${txnId}:${action}`);
      }
    });

    await handleChildDatabaseTxBegin(child, {
      type: 'databaseTxBegin',
      id: 12,
      pluginId: 'com.example.test'
    });
    await handleChildDatabaseTxEnd(child, {
      type: 'databaseTxEnd',
      id: 13,
      pluginId: 'com.example.test',
      txnId: 'txn-1',
      action: 'commit'
    });

    expect(events).toEqual(['begin:com.example.test', 'end:com.example.test:txn-1:commit']);
    expect(child.replies).toEqual([
      { id: 12, ok: true, result: 'txn-1' },
      { id: 13, ok: true }
    ]);
  });
});
