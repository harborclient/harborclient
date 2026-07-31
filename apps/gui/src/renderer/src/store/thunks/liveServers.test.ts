import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultLiveServerCorsSettings,
  defaultLiveServerSslSettings
} from '@harborclient/core/types';
import type { LiveServer, RunningLiveServer } from '@harborclient/core/types';
import {
  formatLiveServerIndexFilesInput,
  liveServerRuntimeConfigNeedsRestart,
  resolveLiveServerLastOpenedPersist,
  toLiveServerConfig
} from '#/renderer/src/store/thunks/liveServers';

describe('formatLiveServerIndexFilesInput', () => {
  it('joins filenames with a comma and space for the editor field', () => {
    expect(formatLiveServerIndexFilesInput(['index.html', 'app.html'])).toBe(
      'index.html, app.html'
    );
  });

  it('returns an empty string for an empty list', () => {
    expect(formatLiveServerIndexFilesInput([])).toBe('');
  });
});

describe('toLiveServerConfig', () => {
  it('normalizes a comma-separated indexFiles editor string', () => {
    const config = toLiveServerConfig({
      name: 'Site',
      root: '/tmp/site',
      port: null,
      aliases: [],
      watch: true,
      indexFiles: 'index.html, app.html'
    });
    expect(config.indexFiles).toEqual(['index.html', 'app.html']);
    expect(config.openPath).toBe('/');
    expect(config.host).toBe('127.0.0.1');
    expect(config.rememberLastUrl).toBe(false);
  });

  it('passes headers through toLiveServerConfig', () => {
    const config = toLiveServerConfig({
      name: 'Site',
      root: '/tmp/site',
      port: null,
      aliases: [],
      watch: true,
      headers: [
        { name: 'Cache-Control', value: 'no-store', enabled: true },
        { name: '', value: 'drop-me', enabled: true }
      ]
    });
    // normalizeLiveServerHeaders keeps empty names; filter for save is panel-side.
    expect(config.headers).toEqual([
      { name: 'Cache-Control', value: 'no-store', enabled: true },
      { name: '', value: 'drop-me', enabled: true }
    ]);
  });

  it('normalizes routes through toLiveServerConfig and drops empty rows', () => {
    const config = toLiveServerConfig({
      name: 'Site',
      root: '/tmp/site',
      port: null,
      aliases: [],
      watch: true,
      routes: [
        { match: '', target: 'index.html' },
        { match: '*', target: '  index.html  ' },
        { match: '^/docs/', target: 'docs', enabled: false }
      ]
    });
    expect(config.routes).toEqual([
      { match: '*', target: 'index.html', enabled: true },
      { match: '^/docs/', target: 'docs', enabled: false }
    ]);
  });

  it('passes SSL settings and CORS extras through toLiveServerConfig', () => {
    const config = toLiveServerConfig({
      name: 'Site',
      root: '/tmp/site',
      port: null,
      aliases: [],
      watch: true,
      cors: {
        enabled: true,
        origin: '*',
        methods: 'GET',
        allowedHeaders: '',
        credentials: false,
        exposedHeaders: 'X-Request-Id',
        maxAge: '600'
      },
      ssl: {
        enabled: true,
        certPath: '/tmp/cert.pem',
        keyPath: '/tmp/key.pem'
      }
    });
    expect(config.cors.exposedHeaders).toBe('X-Request-Id');
    expect(config.cors.maxAge).toBe('600');
    expect(config.ssl).toEqual({
      enabled: true,
      certPath: '/tmp/cert.pem',
      keyPath: '/tmp/key.pem'
    });
  });

  it('trims urlVariable and defaults to empty', () => {
    expect(
      toLiveServerConfig({
        name: 'Site',
        root: '/tmp/site',
        port: null,
        aliases: [],
        watch: true
      }).urlVariable
    ).toBe('');
    expect(
      toLiveServerConfig({
        name: 'Site',
        root: '/tmp/site',
        port: null,
        aliases: [],
        watch: true,
        urlVariable: '  server_url  '
      }).urlVariable
    ).toBe('server_url');
  });
});

/**
 * Builds a minimal saved live server for persist-decision tests.
 *
 * @param overrides - Fields to override on the defaults.
 * @returns A complete {@link LiveServer} row.
 */
function makeSaved(overrides: Partial<LiveServer> = {}): LiveServer {
  return {
    id: 1,
    uuid: 'saved-uuid-1',
    name: 'Site',
    root: '/tmp/site',
    port: 5500,
    aliases: [],
    watch: true,
    cors: defaultLiveServerCorsSettings(),
    openPath: '/',
    rememberLastUrl: true,
    lastOpenedPath: null,
    indexFiles: ['index.html'],
    host: '127.0.0.1',
    headers: [],
    routes: [],
    proxies: [],
    ssl: defaultLiveServerSslSettings(),
    runCommand: '',
    restartOnCrash: false,
    urlVariable: '',
    sortOrder: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  };
}

/**
 * Builds a minimal running instance for persist-decision tests.
 *
 * @param overrides - Fields to override on the defaults.
 * @returns A complete {@link RunningLiveServer}.
 */
function makeRunning(overrides: Partial<RunningLiveServer> = {}): RunningLiveServer {
  const config = toLiveServerConfig({
    name: 'Site',
    root: '/tmp/site',
    port: 5500,
    aliases: [],
    watch: true,
    rememberLastUrl: true
  });
  return {
    id: 'run-1',
    savedId: 1,
    config,
    port: 5500,
    origin: 'http://127.0.0.1:5500',
    startedAt: 0,
    ...overrides
  };
}

describe('liveServerRuntimeConfigNeedsRestart', () => {
  /**
   * Builds a baseline config for restart-detection comparisons.
   *
   * @returns Normalized live server config.
   */
  function baseConfig(): ReturnType<typeof toLiveServerConfig> {
    return toLiveServerConfig({
      name: 'Site',
      root: '/tmp/site',
      port: 5500,
      aliases: [],
      watch: true
    });
  }

  it('returns false when runtime fields match (ignoring display / open-URL fields)', () => {
    const running = baseConfig();
    const draft = toLiveServerConfig({
      ...running,
      name: 'Renamed',
      openPath: '/docs',
      rememberLastUrl: true,
      lastOpenedPath: '/docs/page'
    });
    expect(liveServerRuntimeConfigNeedsRestart(draft, running)).toBe(false);
  });

  it('returns true when routes differ', () => {
    const running = baseConfig();
    const draft = toLiveServerConfig({
      ...running,
      routes: [{ match: '*', target: 'index.html' }]
    });
    expect(liveServerRuntimeConfigNeedsRestart(draft, running)).toBe(true);
  });

  it('returns true when proxies differ', () => {
    const running = baseConfig();
    const draft = toLiveServerConfig({
      ...running,
      proxies: [{ path: '/api', target: 'http://127.0.0.1:3000' }]
    });
    expect(liveServerRuntimeConfigNeedsRestart(draft, running)).toBe(true);
  });

  it('returns true when host, headers, or SSL differ', () => {
    const running = baseConfig();
    expect(
      liveServerRuntimeConfigNeedsRestart(
        toLiveServerConfig({ ...running, host: '0.0.0.0' }),
        running
      )
    ).toBe(true);
    expect(
      liveServerRuntimeConfigNeedsRestart(
        toLiveServerConfig({
          ...running,
          headers: [{ name: 'Cache-Control', value: 'no-store' }]
        }),
        running
      )
    ).toBe(true);
    expect(
      liveServerRuntimeConfigNeedsRestart(
        toLiveServerConfig({
          ...running,
          ssl: { enabled: true, certPath: '/c.pem', keyPath: '/k.pem' }
        }),
        running
      )
    ).toBe(true);
    expect(
      liveServerRuntimeConfigNeedsRestart(
        toLiveServerConfig({
          ...running,
          runCommand: '/usr/bin/node ./server.js',
          restartOnCrash: true
        }),
        running
      )
    ).toBe(true);
  });

  it('ignores urlVariable changes for restart detection', () => {
    const running = baseConfig();
    expect(
      liveServerRuntimeConfigNeedsRestart(
        toLiveServerConfig({
          ...running,
          urlVariable: 'server_url'
        }),
        running
      )
    ).toBe(false);
  });

  it('does not false-positive on equivalent normalized defaults', () => {
    const running = baseConfig();
    const draft = toLiveServerConfig({
      name: running.name,
      root: running.root,
      port: running.port,
      aliases: running.aliases,
      watch: running.watch,
      cors: undefined,
      routes: [],
      proxies: [],
      headers: [],
      ssl: undefined
    });
    expect(liveServerRuntimeConfigNeedsRestart(draft, running)).toBe(false);
  });
});

describe('resolveLiveServerLastOpenedPersist', () => {
  it('returns a persist target when a bound tab navigates within the origin', () => {
    expect(
      resolveLiveServerLastOpenedPersist({
        tabId: 'tab-1',
        url: 'http://127.0.0.1:5500/docs/foo?q=1',
        tabIdsByServerId: { 'run-1': 'tab-1' },
        running: [makeRunning()],
        saved: [makeSaved()]
      })
    ).toEqual({ savedId: 1, lastOpenedPath: '/docs/foo?q=1' });
  });

  it('returns null when rememberLastUrl is false on the saved row', () => {
    expect(
      resolveLiveServerLastOpenedPersist({
        tabId: 'tab-1',
        url: 'http://127.0.0.1:5500/docs',
        tabIdsByServerId: { 'run-1': 'tab-1' },
        running: [makeRunning()],
        saved: [makeSaved({ rememberLastUrl: false })]
      })
    ).toBeNull();
  });

  it('returns null when the path is unchanged', () => {
    expect(
      resolveLiveServerLastOpenedPersist({
        tabId: 'tab-1',
        url: 'http://127.0.0.1:5500/docs',
        tabIdsByServerId: { 'run-1': 'tab-1' },
        running: [makeRunning()],
        saved: [makeSaved({ lastOpenedPath: '/docs' })]
      })
    ).toBeNull();
  });

  it('returns null when the tab is not bound or origin mismatches', () => {
    expect(
      resolveLiveServerLastOpenedPersist({
        tabId: 'other-tab',
        url: 'http://127.0.0.1:5500/docs',
        tabIdsByServerId: { 'run-1': 'tab-1' },
        running: [makeRunning()],
        saved: [makeSaved()]
      })
    ).toBeNull();
    expect(
      resolveLiveServerLastOpenedPersist({
        tabId: 'tab-1',
        url: 'http://example.com/docs',
        tabIdsByServerId: { 'run-1': 'tab-1' },
        running: [makeRunning()],
        saved: [makeSaved()]
      })
    ).toBeNull();
  });

  it('returns null when the running instance has no savedId', () => {
    expect(
      resolveLiveServerLastOpenedPersist({
        tabId: 'tab-1',
        url: 'http://127.0.0.1:5500/docs',
        tabIdsByServerId: { 'run-1': 'tab-1' },
        running: [makeRunning({ savedId: null })],
        saved: [makeSaved()]
      })
    ).toBeNull();
  });
});

const setGlobalVariableMock = vi.hoisted(() => vi.fn());

vi.mock('#/renderer/src/plugins/hostGlobalsCommands', () => ({
  setGlobalVariable: (...args: unknown[]) => setGlobalVariableMock(...args)
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe('startLiveServer urlVariable', () => {
  const startLiveServerApiMock = vi.fn();
  const listRunningLiveServersMock = vi.fn();

  beforeEach(() => {
    setGlobalVariableMock.mockReset();
    setGlobalVariableMock.mockResolvedValue(undefined);
    startLiveServerApiMock.mockReset();
    listRunningLiveServersMock.mockReset();
    vi.stubGlobal('window', {
      api: {
        startLiveServer: startLiveServerApiMock,
        listRunningLiveServers: listRunningLiveServersMock
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets the configured global variable to the server origin on start', async () => {
    const { configureStore } = await import('@reduxjs/toolkit');
    const liveServersReducer = (await import('#/renderer/src/store/slices/liveServersSlice'))
      .default;
    const tabsReducer = (await import('#/renderer/src/store/slices/tabsSlice')).default;
    const { startLiveServer } = await import('#/renderer/src/store/thunks/liveServers');

    const config = toLiveServerConfig({
      name: 'Site',
      root: '/tmp/site',
      port: 6003,
      aliases: [],
      watch: true,
      urlVariable: 'server_url'
    });
    const running: RunningLiveServer = {
      id: 'run-url',
      savedId: null,
      config,
      port: 6003,
      origin: 'http://localhost:6003',
      startedAt: 1
    };
    startLiveServerApiMock.mockResolvedValue(running);
    listRunningLiveServersMock.mockResolvedValue([running]);

    const store = configureStore({
      reducer: {
        liveServers: liveServersReducer,
        tabs: tabsReducer
      }
    });

    await store.dispatch(startLiveServer({ config, openBrowser: false }) as never);

    expect(setGlobalVariableMock).toHaveBeenCalledWith('server_url', 'http://localhost:6003');
  });

  it('does not set a global when urlVariable is empty', async () => {
    const { configureStore } = await import('@reduxjs/toolkit');
    const liveServersReducer = (await import('#/renderer/src/store/slices/liveServersSlice'))
      .default;
    const tabsReducer = (await import('#/renderer/src/store/slices/tabsSlice')).default;
    const { startLiveServer } = await import('#/renderer/src/store/thunks/liveServers');

    const config = toLiveServerConfig({
      name: 'Site',
      root: '/tmp/site',
      port: 6003,
      aliases: [],
      watch: true
    });
    const running: RunningLiveServer = {
      id: 'run-url',
      savedId: null,
      config,
      port: 6003,
      origin: 'http://localhost:6003',
      startedAt: 1
    };
    startLiveServerApiMock.mockResolvedValue(running);
    listRunningLiveServersMock.mockResolvedValue([running]);

    const store = configureStore({
      reducer: {
        liveServers: liveServersReducer,
        tabs: tabsReducer
      }
    });

    await store.dispatch(startLiveServer({ config, openBrowser: false }) as never);

    expect(setGlobalVariableMock).not.toHaveBeenCalled();
  });
});
