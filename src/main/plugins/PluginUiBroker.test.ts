import type { WebContents } from 'electron';
import { ipcMain, webContents } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginManager } from '#/main/plugins/PluginManager';
import { PluginUiBroker } from '#/main/plugins/PluginUiBroker';

const pickFileForPlugin = vi.fn();
const readFileForPlugin = vi.fn();

vi.mock('#/main/plugins/pluginFsOperations', () => ({
  pickFileForPlugin: (...args: unknown[]) => pickFileForPlugin(...args),
  pickDirectoryForPlugin: vi.fn(),
  saveFileForPlugin: vi.fn(),
  readFileForPlugin: (...args: unknown[]) => readFileForPlugin(...args),
  writeFileForPlugin: vi.fn(),
  watchFileForPlugin: vi.fn()
}));

vi.mock('electron', () => {
  const sessionHandlers = new Map<
    string,
    (event: { sender: WebContents }, payload: unknown) => void
  >();
  return {
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(
        (channel: string, handler: (event: { sender: WebContents }, payload: unknown) => void) => {
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
 * Registers a mock plugin webview session with the broker IPC handler.
 *
 * @param sender - Mock webContents used as the bridge caller.
 * @param session - Session metadata stored by the broker.
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
  const handlers = (
    ipcMain as unknown as {
      __sessionHandlers: Map<string, (event: { sender: WebContents }, payload: unknown) => void>;
    }
  ).__sessionHandlers;
  const handler = handlers.get('plugins:uiRegisterSession');
  if (!handler) {
    throw new Error('plugins:uiRegisterSession handler is not registered.');
  }
  handler({ sender }, session);
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

  it('round-trips host.sendHttpRequest through plugins:hostBridgeInvoke', async () => {
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

    const input = {
      method: 'GET',
      url: 'https://example.test',
      headers: [],
      params: [],
      body: '',
      bodyType: 'none'
    };
    const resultPromise = broker.handleInvoke(sender, 'host.sendHttpRequest', { input });

    expect(send).toHaveBeenCalledWith('plugins:hostBridgeInvoke', {
      requestId: 1,
      pluginId: 'com.test.load',
      op: 'host.sendHttpRequest',
      payload: { input }
    });

    const sendResult = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: 'ok',
      timeMs: 42,
      sizeBytes: 2
    };
    broker.completeHostBridgeInvokeForTests({ requestId: 1, ok: true, result: sendResult });

    await expect(resultPromise).resolves.toEqual(sendResult);
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
