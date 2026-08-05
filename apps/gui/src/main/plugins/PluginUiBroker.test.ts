import type { WebContents } from 'electron';
import { ipcMain, webContents } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildPluginAgentUrl,
  buildPluginSurfaceUrl,
  type PluginContributionKind
} from '@harborclient/core/plugin/pluginSurface';
import type { PluginManager } from './PluginManager';
import { PluginUiBroker } from './PluginUiBroker';
import {
  resetPluginMcpRegistryForTests,
  setPluginMcpRegistryMainWindow,
  setPluginMcpRegistryManager
} from './pluginMcpRegistry';
import { pluginSessionPartition } from '#/pluginBridge/pluginUiSession';

const pickFileForPlugin = vi.fn();
const readFileForPlugin = vi.fn();

vi.mock('#/main/plugins/pluginFsOperations', () => ({
  pickFileForPlugin: (...args: unknown[]) => pickFileForPlugin(...args),
  pickDirectoryForPlugin: vi.fn(),
  saveFileForPlugin: vi.fn(),
  readFileForPlugin: (...args: unknown[]) => readFileForPlugin(...args),
  writeFileForPlugin: vi.fn(),
  writeBytesForPlugin: vi.fn(),
  watchFileForPlugin: vi.fn()
}));

vi.mock('#/main/settings/generalSettings', () => ({
  isPluginNetworkAllowed: vi.fn(() => true)
}));

const refreshMcpClientConnections = vi.fn(async () => undefined);

vi.mock('#/main/mcp/mcpClientManager', () => ({
  refreshMcpClientConnections: () => refreshMcpClientConnections()
}));

vi.mock('electron', () => {
  const sessionHandlers = new Map<
    string,
    (event: { sender: WebContents }, payload?: unknown) => void
  >();
  return {
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(
        (channel: string, handler: (event: { sender: WebContents }, payload?: unknown) => void) => {
          sessionHandlers.set(channel, handler);
        }
      ),
      __sessionHandlers: sessionHandlers
    },
    webContents: {
      fromId: vi.fn(() => null)
    }
  };
});

/**
 * Registers a mock plugin webview session by deriving identity from a harbor-plugin URL.
 *
 * @param sender - Mock webContents used as the bridge caller.
 * @param session - Desired session identity (encoded into getURL / partition).
 */
function registerSession(
  sender: WebContents,
  session: {
    pluginId: string;
    role: 'agent' | 'view';
    contributionId?: string;
    kind?: string;
  }
): void {
  const href =
    session.role === 'view'
      ? buildPluginSurfaceUrl(
          session.pluginId,
          session.contributionId ?? 'contrib',
          (session.kind ?? 'mainViews') as PluginContributionKind
        )
      : buildPluginAgentUrl(session.pluginId);

  Object.assign(sender, {
    getURL: () => href,
    session: { partition: pluginSessionPartition(session.pluginId) }
  });

  const handlers = (
    ipcMain as unknown as {
      __sessionHandlers: Map<string, (event: { sender: WebContents }, payload?: unknown) => void>;
    }
  ).__sessionHandlers;
  const handler = handlers.get('plugins:uiRegisterSession');
  if (!handler) {
    throw new Error('plugins:uiRegisterSession handler is not registered.');
  }
  // Registration payload fields are intentionally ignored — identity comes from URL.
  handler(
    { sender },
    {
      pluginId: 'com.attacker.spoof',
      role: 'agent'
    }
  );
}

describe('PluginUiBroker view.reportSize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards plugins:surfaceResize to the main window', async () => {
    const send = vi.fn();
    const mockWindow = {
      isDestroyed: () => false,
      webContents: { send }
    };
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.setMainWindow(() => mockWindow as never);
    broker.registerIpcHandlers();

    const sender = { id: 42 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.harborclient.plugins.aws-sigv',
      role: 'view',
      contributionId: 'aws-request',
      kind: 'requestTabs'
    });

    await broker.handleInvoke(sender, 'view.reportSize', { height: 512.4 });

    expect(send).toHaveBeenCalledWith('plugins:surfaceResize', {
      pluginId: 'com.harborclient.plugins.aws-sigv',
      contributionId: 'aws-request',
      kind: 'requestTabs',
      slot: 'content',
      height: 513
    });
    expect(manager.assertPermission).toHaveBeenCalledWith(
      'com.harborclient.plugins.aws-sigv',
      'ui'
    );
  });

  it('ignores invalid height payloads', async () => {
    const send = vi.fn();
    const mockWindow = {
      isDestroyed: () => false,
      webContents: { send }
    };
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.setMainWindow(() => mockWindow as never);
    broker.registerIpcHandlers();

    const sender = { id: 7 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.test.plugin',
      role: 'view',
      contributionId: 'tab',
      kind: 'requestTabs'
    });

    await broker.handleInvoke(sender, 'view.reportSize', { height: 0 });
    await broker.handleInvoke(sender, 'view.reportSize', { height: Number.NaN });
    await broker.handleInvoke(sender, 'view.reportSize', {});

    expect(send).not.toHaveBeenCalled();
  });

  it('forwards header-actions width reports with slot', async () => {
    const send = vi.fn();
    const mockWindow = {
      isDestroyed: () => false,
      webContents: { send }
    };
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.setMainWindow(() => mockWindow as never);
    broker.registerIpcHandlers();

    const sender = { id: 99 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.test.plugin',
      role: 'view',
      contributionId: 'schemas',
      kind: 'sidebarSections',
      slot: 'headerActions'
    } as never);

    await broker.handleInvoke(sender, 'view.reportSize', {
      width: 28.2,
      height: 34.1,
      slot: 'headerActions'
    });

    expect(send).toHaveBeenCalledWith('plugins:surfaceResize', {
      pluginId: 'com.test.plugin',
      contributionId: 'schemas',
      kind: 'sidebarSections',
      slot: 'headerActions',
      width: 29,
      height: 35
    });
  });
});

describe('PluginUiBroker theme registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards themes.register through plugins:contributions', async () => {
    const send = vi.fn();
    const mockWindow = {
      isDestroyed: () => false,
      webContents: { send }
    };
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.setMainWindow(() => mockWindow as never);
    broker.registerIpcHandlers();

    const sender = { id: 7 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.harborclient.plugins.catppuccin-latte',
      role: 'agent'
    });

    const theme = {
      id: 'latte',
      title: 'Catppuccin Latte',
      type: 'light',
      colors: { surface: '#eff1f5' },
      stylesheet: 'dist/theme.css'
    };

    await broker.handleInvoke(sender, 'themes.register', { theme });

    expect(send).toHaveBeenCalledWith('plugins:contributions', {
      pluginId: 'com.harborclient.plugins.catppuccin-latte',
      op: 'registerContribution',
      kind: 'themes',
      contribution: theme
    });
  });

  it('forwards themes.unregister through plugins:contributions', async () => {
    const send = vi.fn();
    const mockWindow = {
      isDestroyed: () => false,
      webContents: { send }
    };
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.setMainWindow(() => mockWindow as never);
    broker.registerIpcHandlers();

    const sender = { id: 8 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.harborclient.plugins.catppuccin-latte',
      role: 'agent'
    });

    await broker.handleInvoke(sender, 'themes.unregister', { themeId: 'latte' });

    expect(send).toHaveBeenCalledWith('plugins:contributions', {
      pluginId: 'com.harborclient.plugins.catppuccin-latte',
      op: 'unregisterContribution',
      kind: 'themes',
      contributionId: 'latte'
    });
  });
});

describe('PluginUiBroker host bridge invoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards host.applyRequestDraft through plugins:hostBridge', async () => {
    const send = vi.fn();
    const mockWindow = {
      isDestroyed: () => false,
      webContents: { send }
    };
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.setMainWindow(() => mockWindow as never);
    broker.registerIpcHandlers();

    const sender = { id: 4 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.test.curl',
      role: 'view',
      contributionId: 'curl',
      kind: 'requestTabs'
    });

    const payload = {
      payload: {
        method: 'POST',
        url: 'https://example.test',
        headers: { 'Content-Type': 'application/json' },
        body: '{"ok":true}',
        bodyType: 'json'
      }
    };

    await expect(broker.handleInvoke(sender, 'host.applyRequestDraft', payload)).resolves.toBe(
      undefined
    );

    expect(manager.assertPermission).toHaveBeenCalledWith('com.test.curl', 'ui');
    expect(send).toHaveBeenCalledWith('plugins:hostBridge', {
      pluginId: 'com.test.curl',
      op: 'host.applyRequestDraft',
      payload
    });
  });

  it('round-trips host.fetch through plugins:hostBridgeInvoke', async () => {
    const send = vi.fn();
    const mockWindow = {
      isDestroyed: () => false,
      webContents: { send }
    };
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.setMainWindow(() => mockWindow as never);
    broker.registerIpcHandlers();

    const sender = { id: 5 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.test.load',
      role: 'view',
      contributionId: 'load',
      kind: 'requestTabs'
    });

    const payload = {
      input: 'https://example.test',
      init: { method: 'GET' }
    };
    const resultPromise = broker.handleInvoke(sender, 'host.fetch', payload);

    expect(send).toHaveBeenCalledWith('plugins:hostBridgeInvoke', {
      requestId: 1,
      pluginId: 'com.test.load',
      op: 'host.fetch',
      payload
    });

    const fetchResult = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {},
      body: 'ok'
    };
    broker.completeHostBridgeInvokeForTests({ requestId: 1, ok: true, result: fetchResult });

    await expect(resultPromise).resolves.toEqual(fetchResult);
  });

  it('round-trips livePage.open through plugins:hostBridgeInvoke with browser permission', async () => {
    const send = vi.fn();
    const mockWindow = {
      isDestroyed: () => false,
      webContents: { send }
    };
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.setMainWindow(() => mockWindow as never);
    broker.registerIpcHandlers();

    const sender = { id: 71 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.test.browser',
      role: 'agent'
    });

    const payload = { url: 'https://example.test', reuse: true };
    const resultPromise = broker.handleInvoke(sender, 'livePage.open', payload);

    expect(manager.assertPermission).toHaveBeenCalledWith('com.test.browser', 'browser');
    expect(send).toHaveBeenCalledWith('plugins:hostBridgeInvoke', {
      requestId: 1,
      pluginId: 'com.test.browser',
      op: 'livePage.open',
      payload
    });

    const opened = {
      tabId: 'browser-1',
      url: 'https://example.test/',
      title: 'Example',
      canGoBack: false,
      canGoForward: false
    };
    broker.completeHostBridgeInvokeForTests({ requestId: 1, ok: true, result: opened });

    await expect(resultPromise).resolves.toEqual(opened);
  });

  it('rejects livePage.open when the plugin lacks the browser permission', async () => {
    const manager = {
      assertPermission: vi.fn((pluginId: string, permission: string) => {
        if (permission === 'browser') {
          throw new Error(`Plugin ${pluginId} lacks permission: browser`);
        }
      })
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.registerIpcHandlers();

    const sender = { id: 72 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.test.no-browser',
      role: 'agent'
    });

    await expect(
      broker.handleInvoke(sender, 'livePage.open', { url: 'https://example.test' })
    ).rejects.toThrow(/lacks permission: browser/);
  });

  it('round-trips liveServers.list through plugins:hostBridgeInvoke with live-server permission', async () => {
    const send = vi.fn();
    const mockWindow = {
      isDestroyed: () => false,
      webContents: { send }
    };
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.setMainWindow(() => mockWindow as never);
    broker.registerIpcHandlers();

    const sender = { id: 73 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.test.live-server',
      role: 'agent'
    });

    const resultPromise = broker.handleInvoke(sender, 'liveServers.list', {});

    expect(manager.assertPermission).toHaveBeenCalledWith('com.test.live-server', 'live-server');
    expect(send).toHaveBeenCalledWith('plugins:hostBridgeInvoke', {
      requestId: 1,
      pluginId: 'com.test.live-server',
      op: 'liveServers.list',
      payload: {}
    });

    broker.completeHostBridgeInvokeForTests({ requestId: 1, ok: true, result: [] });
    await expect(resultPromise).resolves.toEqual([]);
  });

  it('rejects liveServers.list when the plugin lacks the live-server permission', async () => {
    const manager = {
      assertPermission: vi.fn((pluginId: string, permission: string) => {
        if (permission === 'live-server') {
          throw new Error(`Plugin ${pluginId} lacks permission: live-server`);
        }
      })
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.registerIpcHandlers();

    const sender = { id: 74 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.test.no-live-server',
      role: 'agent'
    });

    await expect(broker.handleInvoke(sender, 'liveServers.list', {})).rejects.toThrow(
      /lacks permission: live-server/
    );
  });

  it('round-trips livePages.list through plugins:hostBridgeInvoke with live-pages permission', async () => {
    const send = vi.fn();
    const mockWindow = {
      isDestroyed: () => false,
      webContents: { send }
    };
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.setMainWindow(() => mockWindow as never);
    broker.registerIpcHandlers();

    const sender = { id: 75 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.test.live-pages',
      role: 'agent'
    });

    const resultPromise = broker.handleInvoke(sender, 'livePages.list', {});

    expect(manager.assertPermission).toHaveBeenCalledWith('com.test.live-pages', 'live-pages');
    expect(send).toHaveBeenCalledWith('plugins:hostBridgeInvoke', {
      requestId: 1,
      pluginId: 'com.test.live-pages',
      op: 'livePages.list',
      payload: {}
    });

    broker.completeHostBridgeInvokeForTests({ requestId: 1, ok: true, result: [] });
    await expect(resultPromise).resolves.toEqual([]);
  });

  it('rejects livePages.list when the plugin lacks the live-pages permission', async () => {
    const manager = {
      assertPermission: vi.fn((pluginId: string, permission: string) => {
        if (permission === 'live-pages') {
          throw new Error(`Plugin ${pluginId} lacks permission: live-pages`);
        }
      })
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.registerIpcHandlers();

    const sender = { id: 76 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.test.no-live-pages',
      role: 'agent'
    });

    await expect(broker.handleInvoke(sender, 'livePages.list', {})).rejects.toThrow(
      /lacks permission: live-pages/
    );
  });

  it('rejects host.fetch when network access is disabled for the plugin', async () => {
    const { isPluginNetworkAllowed } = await import('#/main/settings/generalSettings');
    vi.mocked(isPluginNetworkAllowed).mockReturnValue(false);

    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.registerIpcHandlers();

    const sender = { id: 6 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.test.network',
      role: 'view',
      contributionId: 'load',
      kind: 'requestTabs'
    });

    await expect(
      broker.handleInvoke(sender, 'host.fetch', {
        input: 'https://example.test'
      })
    ).rejects.toThrow(/cannot make network requests/);
  });

  it('round-trips harborclient commands.execute through plugins:hostBridgeInvoke', async () => {
    const send = vi.fn();
    const mockWindow = {
      isDestroyed: () => false,
      webContents: { send }
    };
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.setMainWindow(() => mockWindow as never);
    broker.registerIpcHandlers();

    const sender = { id: 7 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.harborclient.plugins.openapi',
      role: 'agent',
      contributionId: 'openapi',
      kind: 'mainViews'
    });

    const payload = {
      pluginId: 'harborclient',
      commandId: 'openMainView',
      args: ['com.harborclient.plugins.openapi', 'import']
    };
    const resultPromise = broker.handleInvoke(sender, 'commands.execute', payload);

    expect(send).toHaveBeenCalledWith('plugins:hostBridgeInvoke', {
      requestId: 1,
      pluginId: 'com.harborclient.plugins.openapi',
      op: 'commands.execute',
      payload
    });

    broker.completeHostBridgeInvokeForTests({ requestId: 1, ok: true, result: undefined });

    await expect(resultPromise).resolves.toBeUndefined();
  });
});

describe('PluginUiBroker filesystem operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates fs.pickFile to shared filesystem helpers', async () => {
    pickFileForPlugin.mockResolvedValue(['/tmp/example.env']);
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.registerIpcHandlers();

    const sender = { id: 11 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.harborclient.plugins.dotenv',
      role: 'view',
      contributionId: 'import',
      kind: 'mainViews'
    });

    const options = {
      title: 'Select .env file',
      filters: [{ name: 'Env files', extensions: ['env'] }]
    };
    await expect(broker.handleInvoke(sender, 'fs.pickFile', { options })).resolves.toEqual([
      '/tmp/example.env'
    ]);

    expect(manager.assertPermission).toHaveBeenCalledWith(
      'com.harborclient.plugins.dotenv',
      'filesystem:pick'
    );
    expect(pickFileForPlugin).toHaveBeenCalledWith(
      manager,
      'com.harborclient.plugins.dotenv',
      options
    );
  });

  it('delegates fs.readFile to shared filesystem helpers', async () => {
    readFileForPlugin.mockReturnValue('KEY=value\n');
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.registerIpcHandlers();

    const sender = { id: 12 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.harborclient.plugins.dotenv',
      role: 'view',
      contributionId: 'import',
      kind: 'mainViews'
    });

    await expect(
      broker.handleInvoke(sender, 'fs.readFile', { path: '/tmp/example.env' })
    ).resolves.toBe('KEY=value\n');

    expect(manager.assertPermission).toHaveBeenCalledWith(
      'com.harborclient.plugins.dotenv',
      'filesystem:read'
    );
    expect(readFileForPlugin).toHaveBeenCalledWith(
      manager,
      'com.harborclient.plugins.dotenv',
      '/tmp/example.env'
    );
  });

  it('forwards watched file changes to matching plugin webviews', () => {
    const send = vi.fn();
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.registerIpcHandlers();

    const sender = { id: 13 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.harborclient.plugins.dotenv',
      role: 'view',
      contributionId: 'import',
      kind: 'mainViews'
    });

    vi.mocked(webContents.fromId).mockReturnValue({ send } as never);

    broker.notifyFilesystemChanged('com.harborclient.plugins.dotenv', '/tmp/example.env');

    expect(send).toHaveBeenCalledWith('plugin-ui:event', {
      channel: 'fs.watch:/tmp/example.env',
      payload: '/tmp/example.env'
    });
  });
});

describe('PluginUiBroker pushLibraryChanged', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delivers library.changed to loaded ui plugins and skips stale sessions', () => {
    const staleSend = vi.fn();
    const uiSend = vi.fn();
    const getPluginPermissions = vi.fn((pluginId: string) => {
      if (pluginId === 'com.harborclient.plugins.sidebar') {
        return ['ui', 'storage'];
      }
      throw new Error(`Unknown plugin: ${pluginId}`);
    });
    const manager = {
      get: vi.fn((pluginId: string) =>
        pluginId === 'com.harborclient.plugins.sidebar' ? { id: pluginId } : undefined
      ),
      getPluginPermissions
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.registerIpcHandlers();

    const staleSender = { id: 1 } as WebContents;
    const uiSender = { id: 2 } as WebContents;
    registerSession(staleSender, {
      pluginId: 'com.harborclient.plugins.missing',
      role: 'agent'
    });
    registerSession(uiSender, {
      pluginId: 'com.harborclient.plugins.sidebar',
      role: 'agent'
    });

    vi.mocked(webContents.fromId).mockImplementation((id: number) => {
      if (id === 1) {
        return { send: staleSend } as never;
      }
      if (id === 2) {
        return { send: uiSend } as never;
      }
      return undefined;
    });

    const event = { reason: 'collections' as const };

    expect(() => broker.pushLibraryChanged(event)).not.toThrow();

    expect(staleSend).not.toHaveBeenCalled();
    expect(uiSend).toHaveBeenCalledWith('plugin-ui:event', {
      channel: 'library.changed',
      payload: event
    });
    expect(getPluginPermissions).toHaveBeenCalledWith('com.harborclient.plugins.sidebar');
  });
});

describe('PluginUiBroker pushLiveServersRunningChanged', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delivers liveServers.runningChanged only to plugins with live-server permission', () => {
    const otherSend = vi.fn();
    const liveSend = vi.fn();
    const getPluginPermissions = vi.fn((pluginId: string) => {
      if (pluginId === 'com.test.live') {
        return ['live-server'];
      }
      if (pluginId === 'com.test.ui') {
        return ['ui'];
      }
      throw new Error(`Unknown plugin: ${pluginId}`);
    });
    const manager = {
      get: vi.fn((pluginId: string) =>
        pluginId === 'com.test.live' || pluginId === 'com.test.ui' ? { id: pluginId } : undefined
      ),
      getPluginPermissions
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.registerIpcHandlers();

    const otherSender = { id: 1 } as WebContents;
    const liveSender = { id: 2 } as WebContents;
    registerSession(otherSender, {
      pluginId: 'com.test.ui',
      role: 'agent'
    });
    registerSession(liveSender, {
      pluginId: 'com.test.live',
      role: 'agent'
    });

    vi.mocked(webContents.fromId).mockImplementation((id: number) => {
      if (id === 1) {
        return { send: otherSend } as never;
      }
      if (id === 2) {
        return { send: liveSend } as never;
      }
      return undefined;
    });

    broker.pushLiveServersRunningChanged([]);

    expect(otherSend).not.toHaveBeenCalled();
    expect(liveSend).toHaveBeenCalledWith('plugin-ui:event', {
      channel: 'liveServers.runningChanged',
      payload: []
    });
  });
});

describe('PluginUiBroker pushSidebarSelectionChanged', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delivers sidebar.selection.changed to loaded ui plugins and skips stale sessions', () => {
    const staleSend = vi.fn();
    const uiSend = vi.fn();
    const getPluginPermissions = vi.fn((pluginId: string) => {
      if (pluginId === 'com.harborclient.plugins.sidebar') {
        return ['ui', 'storage'];
      }
      throw new Error(`Unknown plugin: ${pluginId}`);
    });
    const manager = {
      get: vi.fn((pluginId: string) =>
        pluginId === 'com.harborclient.plugins.sidebar' ? { id: pluginId } : undefined
      ),
      getPluginPermissions
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.registerIpcHandlers();

    const staleSender = { id: 1 } as WebContents;
    const uiSender = { id: 2 } as WebContents;
    registerSession(staleSender, {
      pluginId: 'com.harborclient.plugins.missing',
      role: 'agent'
    });
    registerSession(uiSender, {
      pluginId: 'com.harborclient.plugins.sidebar',
      role: 'view'
    });

    vi.mocked(webContents.fromId).mockImplementation((id: number) => {
      if (id === 1) {
        return { send: staleSend } as never;
      }
      if (id === 2) {
        return { send: uiSend } as never;
      }
      return undefined as never;
    });

    const selection = { kind: 'collection' as const, collectionId: 9 };
    expect(() => broker.pushSidebarSelectionChanged(selection)).not.toThrow();

    expect(staleSend).not.toHaveBeenCalled();
    expect(uiSend).toHaveBeenCalledWith('plugin-ui:event', {
      channel: 'sidebar.selection.changed',
      payload: selection
    });
    expect(getPluginPermissions).toHaveBeenCalledWith('com.harborclient.plugins.sidebar');
  });
});

describe('PluginUiBroker pushHttpAfterSend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips stale sessions and still delivers to loaded http plugins', () => {
    const staleSend = vi.fn();
    const historySend = vi.fn();
    const getPluginPermissions = vi.fn((pluginId: string) => {
      if (pluginId === 'com.harborclient.plugins.history') {
        return ['ui', 'storage', 'http'];
      }
      throw new Error(`Unknown plugin: ${pluginId}`);
    });
    const manager = {
      get: vi.fn((pluginId: string) =>
        pluginId === 'com.harborclient.plugins.history'
          ? { id: pluginId }
          : pluginId === 'com.harborclient.plugins.aws-sigv4'
            ? undefined
            : undefined
      ),
      getPluginPermissions
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.registerIpcHandlers();

    const staleSender = { id: 1 } as WebContents;
    const historySender = { id: 2 } as WebContents;
    registerSession(staleSender, {
      pluginId: 'com.harborclient.plugins.aws-sigv4',
      role: 'agent'
    });
    registerSession(historySender, {
      pluginId: 'com.harborclient.plugins.history',
      role: 'agent'
    });

    vi.mocked(webContents.fromId).mockImplementation((id: number) => {
      if (id === 1) {
        return { send: staleSend } as never;
      }
      if (id === 2) {
        return { send: historySend } as never;
      }
      return undefined;
    });

    const request = {
      method: 'GET',
      url: 'https://example.test',
      headers: {},
      body: ''
    };
    const response = { status: 200, statusText: 'OK', headers: {}, body: 'ok' };

    expect(() => broker.pushHttpAfterSend(request, response)).not.toThrow();

    expect(staleSend).not.toHaveBeenCalled();
    expect(historySend).toHaveBeenCalledWith('plugin-ui:event', {
      channel: 'http.afterSend',
      payload: { request, response }
    });
    expect(getPluginPermissions).toHaveBeenCalledWith('com.harborclient.plugins.history');
    expect(getPluginPermissions).not.toHaveBeenCalledWith('com.harborclient.plugins.aws-sigv4');
  });
});

describe('PluginUiBroker pushAiAfterTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delivers after-turn events to loaded ai plugins', () => {
    const send = vi.fn();
    const getPluginPermissions = vi.fn((pluginId: string) => {
      if (pluginId === 'com.example.ai') {
        return ['ai'];
      }
      return [];
    });
    const manager = {
      get: vi.fn((pluginId: string) =>
        pluginId === 'com.example.ai' ? { id: pluginId } : undefined
      ),
      getPluginPermissions
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.registerIpcHandlers();

    const sender = { id: 3 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.example.ai',
      role: 'agent'
    });
    vi.mocked(webContents.fromId).mockImplementation((id: number) => {
      if (id === 3) {
        return { send } as never;
      }
      return undefined;
    });

    const payload = {
      chatId: 1,
      model: 'gpt-test',
      userMessage: { content: 'hi' },
      assistantMessage: { content: 'yo' },
      status: 'completed' as const,
      stats: { stepCount: 1, toolCallCount: 0, durationMs: 9 }
    };

    expect(() => broker.pushAiAfterTurn(payload)).not.toThrow();
    expect(send).toHaveBeenCalledWith('plugin-ui:event', {
      channel: 'ai.afterTurn',
      payload
    });
  });
});

describe('PluginUiBroker import handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards imports.registerHandler through plugins:importHandlers', async () => {
    const send = vi.fn();
    const mockWindow = {
      isDestroyed: () => false,
      webContents: { send }
    };
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.setMainWindow(() => mockWindow as never);
    broker.registerIpcHandlers();

    const sender = { id: 9 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.harborclient.plugins.openapi',
      role: 'agent'
    });

    await broker.handleInvoke(sender, 'imports.registerHandler', {
      registrationId: '1',
      extensions: ['.yaml', '.json']
    });

    expect(send).toHaveBeenCalledWith('plugins:importHandlers', {
      pluginId: 'com.harborclient.plugins.openapi',
      op: 'register',
      registrationId: '1',
      extensions: ['.yaml', '.json']
    });
  });

  it('round-trips import handler invocations through the agent webview', async () => {
    const hostSend = vi.fn();
    const mockWindow = {
      isDestroyed: () => false,
      webContents: { send: hostSend }
    };
    const agentSend = vi.fn();
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.setMainWindow(() => mockWindow as never);
    broker.registerIpcHandlers();

    const sender = { id: 10 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.harborclient.plugins.openapi',
      role: 'agent'
    });
    vi.mocked(webContents.fromId).mockReturnValue({ send: agentSend } as never);

    const file = {
      name: 'petstore.yaml',
      path: '/tmp/petstore.yaml',
      extension: '.yaml',
      contents: 'openapi: 3.0.3'
    };
    const resultPromise = broker.invokeImportHandler(
      'com.harborclient.plugins.openapi',
      '1',
      'canImport',
      file
    );

    expect(agentSend).toHaveBeenCalledWith('plugin-ui:event', {
      channel: 'imports.invoke',
      payload: {
        requestId: 1,
        registrationId: '1',
        phase: 'canImport',
        file
      }
    });

    broker.completeAgentImportInvokeForTests({
      requestId: 1,
      ok: true,
      result: true
    });

    await expect(resultPromise).resolves.toBe(true);
  });
});

describe('PluginUiBroker mcp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPluginMcpRegistryForTests();
  });

  it('registers and unregisters plugin MCP servers with the mcp permission', async () => {
    const send = vi.fn();
    const mockWindow = {
      isDestroyed: () => false,
      webContents: { send }
    };
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.setMainWindow(() => mockWindow as never);
    setPluginMcpRegistryManager(manager);
    setPluginMcpRegistryMainWindow(() => mockWindow as never);
    broker.registerIpcHandlers();

    const sender = { id: 99 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.example.wordpress',
      role: 'agent'
    });

    await broker.handleInvoke(sender, 'mcp.registerServer', {
      registrationId: '1',
      name: 'WordPress',
      serverURL: 'https://example.com/mcp',
      enabled: true,
      headers: []
    });

    expect(manager.assertPermission).toHaveBeenCalledWith('com.example.wordpress', 'mcp');
    expect(refreshMcpClientConnections).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('mcp:clientServersChanged');

    await broker.handleInvoke(sender, 'mcp.unregisterServer', {
      registrationId: '1'
    });

    expect(refreshMcpClientConnections).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe('PluginUiBroker payload validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid broker payloads before dispatching', async () => {
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.registerIpcHandlers();

    const sender = { id: 7 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.example.secure',
      role: 'agent'
    });

    await expect(broker.handleInvoke(sender, 'storage.get', { key: '' })).rejects.toThrow(
      /storage\.get/
    );
  });

  it('uses URL-derived plugin id even when registration payload claims another id', async () => {
    const send = vi.fn();
    const mockWindow = {
      isDestroyed: () => false,
      webContents: { send }
    };
    const manager = {
      assertPermission: vi.fn()
    } as unknown as PluginManager;
    const broker = new PluginUiBroker(manager);
    broker.setMainWindow(() => mockWindow as never);
    broker.registerIpcHandlers();

    const sender = { id: 8 } as WebContents;
    registerSession(sender, {
      pluginId: 'com.example.legit',
      role: 'agent'
    });

    await broker.handleInvoke(sender, 'ui.showToast', { message: 'hello' });

    expect(manager.assertPermission).toHaveBeenCalledWith('com.example.legit', 'ui');
    expect(send).toHaveBeenCalledWith('plugins:hostBridge', {
      pluginId: 'com.example.legit',
      op: 'ui.showToast',
      payload: { message: 'hello' }
    });
  });
});
