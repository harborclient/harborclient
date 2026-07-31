import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveServer, RunningLiveServer } from '@harborclient/sdk';
import {
  defaultLiveServerCorsSettings,
  normalizeLiveServerConfigFields
} from '@harborclient/core/types';
import {
  createLiveServerForPlugin,
  getLiveServerForPlugin,
  getLiveServerLogsForPlugin,
  getLiveServerStatusForPlugin,
  listLiveServersForPlugin,
  startLiveServerForPlugin,
  stopLiveServerForPlugin
} from './hostLiveServerCommands';

const listLiveServersMock = vi.fn();
const createLiveServerMock = vi.fn();
const startLiveServerMock = vi.fn();
const stopLiveServerMock = vi.fn();
const listRunningLiveServersMock = vi.fn();
const getLiveServerLogsMock = vi.fn();
const dispatchMock = vi.fn();

vi.mock('#/renderer/src/store/redux', () => ({
  store: {
    dispatch: (...args: unknown[]) => dispatchMock(...args),
    getState: () => ({
      liveServers: {
        saved: [],
        running: [],
        tabIdsByServerId: {},
        logsSavedId: null
      }
    })
  }
}));

/**
 * Builds a minimal saved live server fixture.
 *
 * @param overrides - Fields to override on the base row.
 */
function makeSaved(overrides: Partial<LiveServer> = {}): LiveServer {
  return {
    id: 1,
    uuid: 'ls-1',
    name: 'Preview',
    root: '/tmp/site',
    port: null,
    aliases: [],
    watch: true,
    cors: defaultLiveServerCorsSettings(),
    ...normalizeLiveServerConfigFields(undefined),
    sortOrder: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides
  };
}

/**
 * Builds a minimal running live server fixture.
 *
 * @param overrides - Fields to override on the base instance.
 */
function makeRunning(overrides: Partial<RunningLiveServer> = {}): RunningLiveServer {
  const saved = makeSaved();
  return {
    id: 'run-1',
    savedId: saved.id,
    config: {
      name: saved.name,
      root: saved.root,
      port: saved.port,
      aliases: saved.aliases,
      watch: saved.watch,
      cors: saved.cors,
      openPath: saved.openPath,
      rememberLastUrl: saved.rememberLastUrl,
      lastOpenedPath: saved.lastOpenedPath,
      indexFiles: saved.indexFiles,
      host: saved.host,
      headers: saved.headers,
      routes: saved.routes,
      proxies: saved.proxies,
      ssl: saved.ssl,
      runCommand: saved.runCommand,
      restartOnCrash: saved.restartOnCrash,
      urlVariable: saved.urlVariable
    },
    port: 5500,
    origin: 'http://127.0.0.1:5500',
    startedAt: 2,
    ...overrides
  };
}

beforeEach(() => {
  listLiveServersMock.mockReset();
  createLiveServerMock.mockReset();
  startLiveServerMock.mockReset();
  stopLiveServerMock.mockReset();
  listRunningLiveServersMock.mockReset();
  getLiveServerLogsMock.mockReset();
  dispatchMock.mockReset();
  vi.stubGlobal('window', {
    api: {
      listLiveServers: listLiveServersMock,
      createLiveServer: createLiveServerMock,
      startLiveServer: startLiveServerMock,
      stopLiveServer: stopLiveServerMock,
      listRunningLiveServers: listRunningLiveServersMock,
      getLiveServerLogs: getLiveServerLogsMock
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hostLiveServerCommands', () => {
  it('lists and gets saved live servers by id or uuid', async () => {
    const saved = makeSaved();
    listLiveServersMock.mockResolvedValue([saved]);

    await expect(listLiveServersForPlugin()).resolves.toEqual([saved]);
    await expect(getLiveServerForPlugin(1)).resolves.toEqual(saved);
    await expect(getLiveServerForPlugin('ls-1')).resolves.toEqual(saved);
    await expect(getLiveServerForPlugin(99)).resolves.toBeNull();
  });

  it('creates a saved live server and returns the new row', async () => {
    const created = makeSaved({ id: 2, uuid: 'ls-2', name: 'New' });
    createLiveServerMock.mockResolvedValue([created]);

    await expect(createLiveServerForPlugin({ name: 'New', root: '/tmp/site' })).resolves.toEqual(
      created
    );
    expect(dispatchMock).toHaveBeenCalled();
  });

  it('starts from savedId by loading the saved config', async () => {
    const saved = makeSaved();
    const running = makeRunning();
    listLiveServersMock.mockResolvedValue([saved]);
    startLiveServerMock.mockResolvedValue(running);
    listRunningLiveServersMock.mockResolvedValue([running]);

    await expect(startLiveServerForPlugin({ savedId: 1 })).resolves.toEqual(running);
    expect(startLiveServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        savedId: 1,
        config: expect.objectContaining({ root: '/tmp/site', name: 'Preview' })
      })
    );
  });

  it('starts from an explicit config including expanded fields', async () => {
    const running = makeRunning();
    startLiveServerMock.mockResolvedValue(running);
    listRunningLiveServersMock.mockResolvedValue([running]);

    await expect(
      startLiveServerForPlugin({
        config: {
          name: 'LAN Preview',
          root: '/tmp/site',
          port: 5500,
          aliases: [],
          watch: true,
          cors: {
            ...defaultLiveServerCorsSettings(),
            exposedHeaders: 'X-Request-Id',
            maxAge: '600'
          },
          openPath: '/docs/',
          rememberLastUrl: true,
          lastOpenedPath: null,
          indexFiles: ['index.html', 'app.html'],
          host: '0.0.0.0',
          headers: [{ name: 'Cache-Control', value: 'no-store', enabled: true }],
          routes: [{ match: '*', target: 'index.html', enabled: true }],
          proxies: [
            {
              path: '/api',
              target: 'http://127.0.0.1:3000',
              stripPath: true,
              enabled: true
            }
          ],
          ssl: { enabled: false, certPath: '', keyPath: '' },
          runCommand: '',
          restartOnCrash: false,
          urlVariable: ''
        }
      })
    ).resolves.toEqual(running);

    expect(startLiveServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          openPath: '/docs/',
          rememberLastUrl: true,
          indexFiles: ['index.html', 'app.html'],
          host: '0.0.0.0',
          headers: [{ name: 'Cache-Control', value: 'no-store', enabled: true }],
          routes: [{ match: '*', target: 'index.html', enabled: true }],
          proxies: [
            {
              path: '/api',
              target: 'http://127.0.0.1:3000',
              stripPath: true,
              enabled: true
            }
          ],
          ssl: { enabled: false, certPath: '', keyPath: '' },
          runCommand: '',
          restartOnCrash: false,
          urlVariable: '',
          cors: expect.objectContaining({
            exposedHeaders: 'X-Request-Id',
            maxAge: '600'
          })
        })
      })
    );
  });

  it('stops by savedId and resolves status', async () => {
    const running = makeRunning();
    listRunningLiveServersMock
      .mockResolvedValueOnce([running])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([running]);
    stopLiveServerMock.mockResolvedValue(undefined);

    await stopLiveServerForPlugin({ savedId: 1 });
    expect(stopLiveServerMock).toHaveBeenCalledWith('run-1');
    await expect(getLiveServerStatusForPlugin({ savedId: 1 })).resolves.toBeNull();
    await expect(getLiveServerStatusForPlugin({ id: 'run-1' })).resolves.toEqual(running);
  });

  it('returns trailing log lines clamped by limit', async () => {
    const lines = Array.from({ length: 5 }, (_, index) => ({
      id: 'run-1',
      savedId: 1,
      timestamp: index,
      method: 'GET',
      url: `/${index}`,
      statusCode: 200,
      durationMs: 1,
      contentLength: null
    }));
    getLiveServerLogsMock.mockResolvedValue(lines);

    await expect(getLiveServerLogsForPlugin({ savedId: 1, limit: 2 })).resolves.toEqual(
      lines.slice(3)
    );
  });
});
