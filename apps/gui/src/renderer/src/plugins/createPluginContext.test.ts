import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@harborclient/core/plugin/databaseTypes';
import type { PluginManifest } from '@harborclient/core/plugin/types';
import { createPluginContext } from './createPluginContext';
import { clearPluginAfterSendSubscribers, emitPluginAfterSend } from './pluginAfterSendBus';
import {
  clearPluginLibraryChangedSubscribers,
  emitPluginLibraryChanged
} from './pluginLibraryChangedBus';
import {
  clearPluginWorkflowsChangedSubscribers,
  emitPluginWorkflowsChanged
} from './pluginWorkflowsChangedBus';
import {
  clearPluginSidebarSelectionSubscribers,
  emitPluginSidebarSelectionChanged
} from './pluginSidebarSelectionBus';
import {
  clearPluginLiveServersSubscribers,
  emitPluginLiveServersRunningChanged
} from './pluginLiveServersBus';
import * as scriptLivePageBridge from '#/renderer/src/scripting/scriptLivePageBridge';

const invokePluginMainMock =
  vi.fn<(pluginId: string, channel: string, args: unknown[]) => Promise<unknown>>();
const activatePluginMainMock = vi.fn<(pluginId: string) => Promise<void>>();

/**
 * Builds a minimal plugin manifest for createPluginContext tests.
 *
 * @param permissions - Granted plugin permissions.
 */
function createManifest(permissions: PluginManifest['permissions']): PluginManifest {
  return {
    id: 'com.example.test',
    name: 'Test Plugin',
    version: '1.0.0',
    engines: { harborclient: '>=1.0.0' },
    renderer: 'dist/renderer.js',
    permissions
  };
}

beforeEach(() => {
  invokePluginMainMock.mockReset();
  activatePluginMainMock.mockReset();
  clearPluginAfterSendSubscribers();
  clearPluginLibraryChangedSubscribers();
  clearPluginWorkflowsChangedSubscribers();
  clearPluginSidebarSelectionSubscribers();
  clearPluginLiveServersSubscribers();

  vi.stubGlobal('window', {
    api: {
      invokePluginMain: invokePluginMainMock,
      activatePluginMain: activatePluginMainMock,
      pushPluginHttpAfterSend: vi.fn().mockResolvedValue(undefined),
      pushPluginLibraryChanged: vi.fn().mockResolvedValue(undefined),
      pushPluginWorkflowsChanged: vi.fn().mockResolvedValue(undefined),
      pushPluginSidebarSelectionChanged: vi.fn().mockResolvedValue(undefined),
      pushPluginLiveServersRunningChanged: vi.fn().mockResolvedValue(undefined),
      pushPluginLiveServerRequestLog: vi.fn().mockResolvedValue(undefined),
      listCollections: vi.fn().mockResolvedValue({ collections: [], warnings: [] }),
      listFolders: vi.fn().mockResolvedValue([]),
      listRequests: vi.fn().mockResolvedValue([]),
      listDocuments: vi.fn().mockResolvedValue([]),
      listWorkflows: vi.fn().mockResolvedValue([]),
      listLiveServers: vi.fn().mockResolvedValue([]),
      listRunningLiveServers: vi.fn().mockResolvedValue([]),
      getLiveServerLogs: vi.fn().mockResolvedValue([])
    }
  });
});

afterEach(() => {
  clearPluginAfterSendSubscribers();
  clearPluginLibraryChangedSubscribers();
  clearPluginWorkflowsChangedSubscribers();
  clearPluginSidebarSelectionSubscribers();
  clearPluginLiveServersSubscribers();
  vi.unstubAllGlobals();
});

describe('createPluginContext runtime surfaces', () => {
  it('exposes hc.http.onAfterSend when the http permission is granted', async () => {
    const hc = createPluginContext('com.example.test', createManifest(['http']));
    const handler = vi.fn();
    const disposable = hc.http.onAfterSend(handler);

    expect(hc.subscriptions).toHaveLength(1);
    expect(hc.subscriptions[0]).toBe(disposable);

    // Legacy push pattern remains safe (idempotent dispose).
    hc.subscriptions.push(disposable);

    emitPluginAfterSend(
      { method: 'GET', url: 'https://example.com', headers: {}, body: '' },
      { status: 200, statusText: 'OK', headers: {}, body: '' }
    );

    await Promise.resolve();
    expect(handler).toHaveBeenCalledTimes(1);

    disposable.dispose();
    disposable.dispose();
    expect(hc.subscriptions).toHaveLength(1);
  });

  it('auto-tracks registration disposables without a manual push', () => {
    const hc = createPluginContext('com.example.test', createManifest(['http']));
    expect(hc.subscriptions).toHaveLength(0);

    const disposable = hc.http.onAfterSend(() => {});
    expect(hc.subscriptions).toContain(disposable);

    disposable.dispose();
    expect(hc.subscriptions).not.toContain(disposable);
  });

  it('rejects hc.http.onAfterSend without the http permission', () => {
    const hc = createPluginContext('com.example.test', createManifest(['ui']));
    expect(() => hc.http.onAfterSend(() => {})).toThrow(/lacks permission: http/);
  });

  it('invokes plugin main IPC and reactivates once when the runtime is inactive', async () => {
    invokePluginMainMock
      .mockRejectedValueOnce(new Error('Plugin main runtime is not active: com.example.test'))
      .mockResolvedValueOnce(['pending']);
    activatePluginMainMock.mockResolvedValue(undefined);

    const hc = createPluginContext('com.example.test', createManifest(['ipc']));
    const result = await hc.ipc.invoke<string[]>('pullPending');

    expect(result).toEqual(['pending']);
    expect(activatePluginMainMock).toHaveBeenCalledWith('com.example.test');
    expect(invokePluginMainMock).toHaveBeenCalledTimes(2);
  });

  it('rejects hc.ipc.invoke without the ipc permission', async () => {
    const hc = createPluginContext('com.example.test', createManifest(['ui']));
    await expect(hc.ipc.invoke('pullPending')).rejects.toThrow(/lacks permission: ipc/);
  });

  it('rejects hc.host commands without the ui permission', async () => {
    const hc = createPluginContext('com.example.test', createManifest(['storage']));
    await expect(hc.host.openRequestDraft({ url: 'https://example.com' })).rejects.toThrow(
      /lacks permission: ui/
    );
    await expect(hc.host.loadRequest(1)).rejects.toThrow(/lacks permission: ui/);
    await expect(hc.host.loadDocument(1)).rejects.toThrow(/lacks permission: ui/);
    await expect(hc.host.openCollectionSettings(1)).rejects.toThrow(/lacks permission: ui/);
    await expect(hc.host.getSidebarSelection()).rejects.toThrow(/lacks permission: ui/);
    expect(() => hc.host.onSidebarSelectionChanged(() => {})).toThrow(/lacks permission: ui/);
    await expect(hc.host.sendRequest()).rejects.toThrow(/lacks permission: ui/);
    await expect(hc.host.createEnvironmentWithVariables('Dev', [])).rejects.toThrow(
      /lacks permission: ui/
    );
    await expect(hc.host.updateEnvironmentVariables(1, [])).rejects.toThrow(/lacks permission: ui/);
    await expect(hc.host.listCollections()).rejects.toThrow(/lacks permission: ui/);
    await expect(hc.host.listLibraryTree()).rejects.toThrow(/lacks permission: ui/);
    expect(() => hc.host.onLibraryChanged(() => {})).toThrow(/lacks permission: ui/);
    await expect(hc.host.listWorkflows()).rejects.toThrow(/lacks permission: ui/);
    expect(() => hc.host.onWorkflowsChanged(() => {})).toThrow(/lacks permission: ui/);
  });

  it('tracks and disposes hc.host.onLibraryChanged subscriptions', () => {
    const hc = createPluginContext('com.example.test', createManifest(['ui']));
    const listener = vi.fn();
    const disposable = hc.host.onLibraryChanged(listener);

    expect(hc.subscriptions).toContain(disposable);
    emitPluginLibraryChanged({ reason: 'collections' });
    expect(listener).toHaveBeenCalledWith({ reason: 'collections' });

    disposable.dispose();
    expect(hc.subscriptions).not.toContain(disposable);
    emitPluginLibraryChanged({ reason: 'folders', collectionId: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('tracks and disposes hc.host.onWorkflowsChanged subscriptions', () => {
    const hc = createPluginContext('com.example.test', createManifest(['ui']));
    const listener = vi.fn();
    const disposable = hc.host.onWorkflowsChanged(listener);

    expect(hc.subscriptions).toContain(disposable);
    emitPluginWorkflowsChanged({ reason: 'created', workflowId: 3 });
    expect(listener).toHaveBeenCalledWith({ reason: 'created', workflowId: 3 });

    disposable.dispose();
    expect(hc.subscriptions).not.toContain(disposable);
    emitPluginWorkflowsChanged({ reason: 'deleted', workflowId: 3 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('tracks and disposes hc.host.onSidebarSelectionChanged subscriptions', () => {
    const hc = createPluginContext('com.example.test', createManifest(['ui']));
    const listener = vi.fn();
    const disposable = hc.host.onSidebarSelectionChanged(listener);

    expect(hc.subscriptions).toContain(disposable);
    emitPluginSidebarSelectionChanged({ kind: 'collection', collectionId: 2 });
    expect(listener).toHaveBeenCalledWith({ kind: 'collection', collectionId: 2 });

    disposable.dispose();
    expect(hc.subscriptions).not.toContain(disposable);
    emitPluginSidebarSelectionChanged({ kind: 'folder', collectionId: 2, folderId: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('lists an empty library through hc.host.listCollections', async () => {
    const hc = createPluginContext('com.example.test', createManifest(['ui']));
    await expect(hc.host.listCollections()).resolves.toEqual([]);
    await expect(hc.host.listLibraryTree()).resolves.toEqual({ collections: [], warnings: [] });
  });

  it('rejects hc.host.sendHttpRequest without the network permission', async () => {
    const hc = createPluginContext('com.example.test', createManifest(['ui']));
    await expect(
      hc.host.sendHttpRequest({
        method: 'GET',
        url: 'https://example.com',
        headers: [],
        params: [],
        body: '',
        bodyType: 'none'
      })
    ).rejects.toThrow(/lacks permission: network/);
  });

  it('rejects hc.fs.watchFile without the filesystem:read permission', () => {
    const hc = createPluginContext('com.example.test', createManifest(['ui']));
    expect(() => hc.fs.watchFile('/tmp/example.env', () => {})).toThrow(
      /lacks permission: filesystem:read/
    );
  });

  it('rejects hc.database.get without the database permission', async () => {
    const hc = createPluginContext('com.example.test', createManifest(['storage']));
    await expect(hc.database.get('SELECT 1')).rejects.toThrow(/lacks permission: database/);
  });

  it('rejects hc.livePage without the browser permission', async () => {
    const hc = createPluginContext('com.example.test', createManifest(['ui']));
    await expect(hc.livePage('https://example.com')).rejects.toThrow(/lacks permission: browser/);
  });

  it('rejects hc.liveServers without the live-server permission', async () => {
    const hc = createPluginContext('com.example.test', createManifest(['ui']));
    await expect(hc.liveServers.list()).rejects.toThrow(/lacks permission: live-server/);
  });

  it('rejects hc.livePages without the live-pages permission', async () => {
    const hc = createPluginContext('com.example.test', createManifest(['ui']));
    await expect(hc.livePages.list()).rejects.toThrow(/lacks permission: live-pages/);
  });

  it('lists live servers and tracks onRunningChanged when live-server is granted', async () => {
    const listLiveServers = vi.fn().mockResolvedValue([
      {
        id: 1,
        uuid: 'ls-1',
        name: 'Preview',
        root: '/tmp/site',
        port: null,
        aliases: [],
        watch: true,
        cors: {
          enabled: true,
          origin: '*',
          methods: 'GET',
          allowedHeaders: '*',
          credentials: false
        },
        sortOrder: 0,
        createdAt: 1,
        updatedAt: 1
      }
    ]);
    vi.stubGlobal('window', {
      api: {
        ...window.api,
        listLiveServers
      }
    });

    const hc = createPluginContext('com.example.test', createManifest(['live-server']));
    await expect(hc.liveServers.list()).resolves.toHaveLength(1);

    const listener = vi.fn();
    const disposable = hc.liveServers.onRunningChanged(listener);
    emitPluginLiveServersRunningChanged([]);
    expect(listener).toHaveBeenCalledWith([]);
    disposable.dispose();
  });

  it('lists, creates, updates, and deletes live pages when live-pages is granted', async () => {
    const saved = {
      id: 1,
      uuid: 'lp-1',
      name: 'Example',
      url: 'https://example.com/',
      homeUrl: 'https://example.com/',
      faviconDataUrl: null,
      scripts: [],
      preRequestScripts: [],
      postRequestScripts: [],
      variables: [],
      headers: [],
      userAgent: '',
      auth: {
        type: 'none' as const,
        basic: { username: '', password: '' },
        bearer: { token: '' },
        oauth2: {
          tokenUrl: '',
          clientId: '',
          clientSecret: '',
          scope: '',
          audience: '',
          clientAuth: 'body' as const
        }
      },
      createdAt: 1,
      updatedAt: 1
    };
    const created = { ...saved, id: 2, uuid: 'lp-2', name: 'Created' };
    const updated = { ...created, name: 'Updated' };
    const listWebsites = vi.fn().mockResolvedValue([saved]);
    const createWebsite = vi.fn().mockResolvedValue([created]);
    const updateWebsite = vi.fn().mockResolvedValue([updated]);
    const deleteWebsite = vi.fn().mockResolvedValue([]);
    vi.stubGlobal('window', {
      api: {
        ...window.api,
        listWebsites,
        createWebsite,
        updateWebsite,
        deleteWebsite
      }
    });

    const hc = createPluginContext('com.example.test', createManifest(['live-pages']));
    await expect(hc.livePages.list()).resolves.toHaveLength(1);
    await expect(
      hc.livePages.create({
        name: 'Created',
        url: 'https://example.com/',
        homeUrl: 'https://example.com/'
      })
    ).resolves.toMatchObject({ id: 2, name: 'Created' });
    await expect(
      hc.livePages.update({
        ...created,
        name: 'Updated'
      })
    ).resolves.toMatchObject({ name: 'Updated' });
    await expect(hc.livePages.delete(2)).resolves.toBeUndefined();
    expect(deleteWebsite).toHaveBeenCalledWith(2);
  });

  it('opens, focuses, queries, and closes a webpage when browser permission is granted', async () => {
    const execute = vi
      .spyOn(scriptLivePageBridge, 'executeScriptLivePageRequest')
      .mockResolvedValueOnce({
        tabId: 'browser-3',
        url: 'https://example.com/',
        title: 'Example',
        canGoBack: false,
        canGoForward: false
      })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        selector: 'h1',
        matchCount: 1,
        elements: [{ tagName: 'H1', textContent: 'Hello' }]
      })
      .mockResolvedValueOnce({ closed: true });

    const hc = createPluginContext('com.example.test', createManifest(['browser']));
    const page = await hc.livePage('https://example.com');

    expect(page.tabId).toBe('browser-3');
    expect(page.url).toBe('https://example.com/');
    await page.focus();
    await expect(page.dom.query('h1')).resolves.toEqual({
      selector: 'h1',
      matchCount: 1,
      elements: [{ tagName: 'H1', textContent: 'Hello' }]
    });
    await expect(page.close()).resolves.toBe(true);

    expect(execute).toHaveBeenNthCalledWith(1, {
      op: 'open',
      url: 'https://example.com',
      reuse: undefined
    });
    expect(execute).toHaveBeenNthCalledWith(2, { op: 'focus', tabId: 'browser-3' });
    expect(execute).toHaveBeenNthCalledWith(3, {
      op: 'query',
      tabId: 'browser-3',
      selector: 'h1',
      all: undefined,
      maxElements: undefined
    });
    expect(execute).toHaveBeenNthCalledWith(4, { op: 'close', tabId: 'browser-3' });
  });
});
