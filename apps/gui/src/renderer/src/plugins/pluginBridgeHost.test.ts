import { describe, expect, it, vi } from 'vitest';
import {
  defaultLiveServerCorsSettings,
  normalizeLiveServerConfigFields
} from '@harborclient/core/types';
import {
  applyContributionMessage,
  handlePluginHostBridge,
  handlePluginHostBridgeInvoke
} from './pluginBridgeHost';
import * as hostCommands from './hostCommands';
import * as hostRequestCommands from './hostRequestCommands';
import * as hostLibraryCommands from './hostLibraryCommands';
import * as hostLibraryMutations from './hostLibraryMutations';
import * as hostEntityContextMenu from './hostEntityContextMenu';
import * as hostLiveServerCommands from './hostLiveServerCommands';
import * as scriptWebpageBridge from '#/renderer/src/scripting/scriptWebpageBridge';
import {
  clearPluginContributions,
  getRegisteredPluginThemes,
  getRegisteredSidebarRailItems
} from './registry';

describe('handlePluginHostBridgeInvoke', () => {
  it('returns sendHttpRequestForPlugin result for host.sendHttpRequest', async () => {
    const sendResult = {
      status: 200,
      statusText: 'OK',
      headers: {},
      body: 'ok',
      timeMs: 12,
      sizeBytes: 2
    };
    vi.spyOn(hostRequestCommands, 'sendHttpRequestForPlugin').mockResolvedValue(sendResult);

    const result = await handlePluginHostBridgeInvoke({
      requestId: 1,
      pluginId: 'com.test.load',
      op: 'host.sendHttpRequest',
      payload: {
        input: {
          method: 'GET',
          url: 'https://example.test',
          headers: [],
          params: [],
          body: '',
          bodyType: 'none'
        }
      }
    });

    expect(result).toEqual(sendResult);
  });

  it('routes webpage.* ops through executeScriptWebpageRequest', async () => {
    const opened = {
      tabId: 'browser-9',
      url: 'https://example.test/',
      title: 'Example',
      canGoBack: false,
      canGoForward: false
    };
    const execute = vi
      .spyOn(scriptWebpageBridge, 'executeScriptWebpageRequest')
      .mockResolvedValueOnce(opened)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        selector: 'h1',
        matchCount: 1,
        elements: [{ tagName: 'H1', textContent: 'Hello' }]
      })
      .mockResolvedValueOnce({ closed: true });

    await expect(
      handlePluginHostBridgeInvoke({
        requestId: 10,
        pluginId: 'com.test.browser',
        op: 'webpage.open',
        payload: { url: 'https://example.test', reuse: true }
      })
    ).resolves.toEqual(opened);

    await expect(
      handlePluginHostBridgeInvoke({
        requestId: 11,
        pluginId: 'com.test.browser',
        op: 'webpage.focus',
        payload: { tabId: 'browser-9' }
      })
    ).resolves.toBeUndefined();

    await expect(
      handlePluginHostBridgeInvoke({
        requestId: 12,
        pluginId: 'com.test.browser',
        op: 'webpage.query',
        payload: { tabId: 'browser-9', selector: 'h1' }
      })
    ).resolves.toEqual({
      selector: 'h1',
      matchCount: 1,
      elements: [{ tagName: 'H1', textContent: 'Hello' }]
    });

    await expect(
      handlePluginHostBridgeInvoke({
        requestId: 13,
        pluginId: 'com.test.browser',
        op: 'webpage.close',
        payload: { tabId: 'browser-9' }
      })
    ).resolves.toEqual({ closed: true });

    expect(execute).toHaveBeenNthCalledWith(1, {
      op: 'open',
      url: 'https://example.test',
      reuse: true
    });
    expect(execute).toHaveBeenNthCalledWith(2, { op: 'focus', tabId: 'browser-9' });
    expect(execute).toHaveBeenNthCalledWith(3, {
      op: 'query',
      tabId: 'browser-9',
      selector: 'h1',
      all: undefined,
      maxElements: undefined
    });
    expect(execute).toHaveBeenNthCalledWith(4, { op: 'close', tabId: 'browser-9' });
  });

  it('throws when a webpage session returns an error object', async () => {
    vi.spyOn(scriptWebpageBridge, 'executeScriptWebpageRequest').mockResolvedValue({
      error: 'No active browser tab'
    });

    await expect(
      handlePluginHostBridgeInvoke({
        requestId: 14,
        pluginId: 'com.test.browser',
        op: 'webpage.open',
        payload: {}
      })
    ).rejects.toThrow('No active browser tab');
  });

  it('routes liveServers.* ops through host live-server helpers', async () => {
    const fields = normalizeLiveServerConfigFields(undefined);
    const cors = defaultLiveServerCorsSettings();
    const saved = [
      {
        id: 1,
        uuid: 'ls-1',
        name: 'Preview',
        root: '/tmp/site',
        port: null,
        aliases: [],
        watch: true,
        cors,
        ...fields,
        sortOrder: 0,
        createdAt: 1,
        updatedAt: 1
      }
    ];
    const running = {
      id: 'run-1',
      savedId: 1,
      config: {
        name: 'Preview',
        root: '/tmp/site',
        port: null,
        aliases: [],
        watch: true,
        cors,
        ...fields
      },
      port: 5500,
      origin: 'http://127.0.0.1:5500',
      startedAt: 2
    };
    vi.spyOn(hostLiveServerCommands, 'listLiveServersForPlugin').mockResolvedValue(saved);
    vi.spyOn(hostLiveServerCommands, 'startLiveServerForPlugin').mockResolvedValue(running);
    vi.spyOn(hostLiveServerCommands, 'getLiveServerStatusForPlugin').mockResolvedValue(running);
    vi.spyOn(hostLiveServerCommands, 'getLiveServerLogsForPlugin').mockResolvedValue([]);

    await expect(
      handlePluginHostBridgeInvoke({
        requestId: 20,
        pluginId: 'com.test.live',
        op: 'liveServers.list',
        payload: {}
      })
    ).resolves.toEqual(saved);

    await expect(
      handlePluginHostBridgeInvoke({
        requestId: 21,
        pluginId: 'com.test.live',
        op: 'liveServers.start',
        payload: { input: { savedId: 1 } }
      })
    ).resolves.toEqual(running);

    await expect(
      handlePluginHostBridgeInvoke({
        requestId: 22,
        pluginId: 'com.test.live',
        op: 'liveServers.getStatus',
        payload: { query: { savedId: 1 } }
      })
    ).resolves.toEqual(running);

    await expect(
      handlePluginHostBridgeInvoke({
        requestId: 23,
        pluginId: 'com.test.live',
        op: 'liveServers.getLogs',
        payload: { query: { savedId: 1, limit: 10 } }
      })
    ).resolves.toEqual([]);
  });

  it('routes host.listCollections and host.listLibraryTree to library helpers', async () => {
    const collections = [
      { id: 1, uuid: 'c1', name: 'API', created_at: '2026-01-01T00:00:00.000Z' }
    ];
    const tree = {
      collections: [{ ...collections[0], folders: [], requests: [], documents: [] }],
      warnings: []
    };
    vi.spyOn(hostLibraryCommands, 'listCollectionsForPlugin').mockResolvedValue(collections);
    vi.spyOn(hostLibraryCommands, 'listLibraryTreeForPlugin').mockResolvedValue(tree);

    await expect(
      handlePluginHostBridgeInvoke({
        requestId: 5,
        pluginId: 'com.test.sidebar',
        op: 'host.listCollections',
        payload: { options: { includeArchived: true } }
      })
    ).resolves.toEqual(collections);

    await expect(
      handlePluginHostBridgeInvoke({
        requestId: 6,
        pluginId: 'com.test.sidebar',
        op: 'host.listLibraryTree',
        payload: { options: {} }
      })
    ).resolves.toEqual(tree);

    expect(hostLibraryCommands.listCollectionsForPlugin).toHaveBeenCalledWith({
      includeArchived: true
    });
    expect(hostLibraryCommands.listLibraryTreeForPlugin).toHaveBeenCalledWith({});
  });

  it('routes granular library list ops', async () => {
    vi.spyOn(hostLibraryCommands, 'listFoldersForPlugin').mockResolvedValue([]);
    vi.spyOn(hostLibraryCommands, 'listRequestsForPlugin').mockResolvedValue([]);
    vi.spyOn(hostLibraryCommands, 'listDocumentsForPlugin').mockResolvedValue([]);

    await handlePluginHostBridgeInvoke({
      requestId: 7,
      pluginId: 'com.test.sidebar',
      op: 'host.listFolders',
      payload: { collectionId: 3 }
    });
    await handlePluginHostBridgeInvoke({
      requestId: 8,
      pluginId: 'com.test.sidebar',
      op: 'host.listRequests',
      payload: { collectionId: 3 }
    });
    await handlePluginHostBridgeInvoke({
      requestId: 9,
      pluginId: 'com.test.sidebar',
      op: 'host.listDocuments',
      payload: { collectionId: 3 }
    });

    expect(hostLibraryCommands.listFoldersForPlugin).toHaveBeenCalledWith(3);
    expect(hostLibraryCommands.listRequestsForPlugin).toHaveBeenCalledWith(3);
    expect(hostLibraryCommands.listDocumentsForPlugin).toHaveBeenCalledWith(3);
  });

  it('routes host.createFolder to library mutation helpers', async () => {
    const folder = {
      id: 10,
      uuid: 'folder-10',
      collection_id: 1,
      parent_folder_id: null,
      name: 'Auth',
      sort_order: 0,
      created_at: '2026-01-01T00:00:00.000Z'
    };
    vi.spyOn(hostLibraryMutations, 'createFolderForPlugin').mockResolvedValue(folder);

    await expect(
      handlePluginHostBridgeInvoke({
        requestId: 10,
        pluginId: 'com.test.sidebar',
        op: 'host.createFolder',
        payload: { collectionId: 1, name: 'Auth' }
      })
    ).resolves.toEqual(folder);

    expect(hostLibraryMutations.createFolderForPlugin).toHaveBeenCalledWith({
      collectionId: 1,
      name: 'Auth'
    });
  });

  it('routes host.reorderContainerItems to library mutation helpers', async () => {
    const reorderSpy = vi
      .spyOn(hostLibraryMutations, 'reorderContainerItemsForPlugin')
      .mockResolvedValue(undefined);

    await expect(
      handlePluginHostBridgeInvoke({
        requestId: 11,
        pluginId: 'com.test.sidebar',
        op: 'host.reorderContainerItems',
        payload: {
          collectionId: 1,
          folderId: null,
          items: [
            { kind: 'request', id: 1 },
            { kind: 'document', id: 2 }
          ]
        }
      })
    ).resolves.toBeUndefined();

    expect(reorderSpy).toHaveBeenCalledWith({
      collectionId: 1,
      folderId: null,
      items: [
        { kind: 'request', id: 1 },
        { kind: 'document', id: 2 }
      ]
    });
  });

  it('executes harborclient commands through handlePluginHostBridgeInvoke', async () => {
    const executeMock = vi
      .spyOn(hostCommands, 'executeHostPluginCommand')
      .mockResolvedValue(undefined);

    const result = await handlePluginHostBridgeInvoke({
      requestId: 2,
      pluginId: 'com.harborclient.plugins.openapi',
      op: 'commands.execute',
      payload: {
        pluginId: 'harborclient',
        commandId: 'openMainView',
        args: ['com.harborclient.plugins.openapi', 'import']
      }
    });

    expect(result).toBeUndefined();
    expect(executeMock).toHaveBeenCalledWith(
      'openMainView',
      'com.harborclient.plugins.openapi',
      'import'
    );
  });

  it('propagates executeHostPluginCommand failures', async () => {
    vi.spyOn(hostCommands, 'executeHostPluginCommand').mockRejectedValue(new Error('tab failed'));

    await expect(
      handlePluginHostBridgeInvoke({
        requestId: 3,
        pluginId: 'com.harborclient.plugins.openapi',
        op: 'commands.execute',
        payload: {
          pluginId: 'harborclient',
          commandId: 'openMainView',
          args: ['com.harborclient.plugins.openapi', 'import']
        }
      })
    ).rejects.toThrow('tab failed');
  });

  it('rejects commands.execute for non-harborclient owners', async () => {
    await expect(
      handlePluginHostBridgeInvoke({
        requestId: 4,
        pluginId: 'com.harborclient.plugins.openapi',
        op: 'commands.execute',
        payload: {
          pluginId: 'com.other.plugin',
          commandId: 'openMainView',
          args: []
        }
      })
    ).rejects.toThrow(/Unsupported commands.execute target/);
  });
});

describe('handlePluginHostBridge', () => {
  it('routes host.showEntityContextMenu to the host menu helper', async () => {
    const showSpy = vi
      .spyOn(hostEntityContextMenu, 'showEntityContextMenuForPlugin')
      .mockImplementation(() => undefined);

    const input = {
      target: { type: 'collection' as const, collectionId: 1 },
      x: 10,
      y: 20,
      pluginId: 'com.test.sidebar',
      contributionId: 'collections'
    };

    await handlePluginHostBridge({
      pluginId: 'com.test.sidebar',
      op: 'host.showEntityContextMenu',
      payload: input
    });

    expect(showSpy).toHaveBeenCalledWith(input);
  });
});

describe('applyContributionMessage', () => {
  it('registers plugin themes from agent webview contribution messages', () => {
    applyContributionMessage({
      pluginId: 'com.example.theme',
      op: 'registerContribution',
      kind: 'themes',
      contribution: {
        id: 'latte',
        title: 'Latte',
        type: 'light',
        colors: { surface: '#eff1f5' }
      }
    });

    expect(getRegisteredPluginThemes()).toEqual([
      expect.objectContaining({
        pluginId: 'com.example.theme',
        id: 'latte',
        title: 'Latte',
        type: 'light'
      })
    ]);

    clearPluginContributions('com.example.theme');
  });

  it('registers sidebar rail items from agent webview contribution messages', () => {
    applyContributionMessage({
      pluginId: 'com.example.rail',
      op: 'registerContribution',
      kind: 'sidebarRailItems',
      contribution: {
        id: 'plugin:com.example.rail:tools',
        title: 'Tools',
        icon: 'bolt',
        order: 10,
        contributionId: 'tools'
      }
    });

    expect(getRegisteredSidebarRailItems()).toEqual([
      expect.objectContaining({
        pluginId: 'com.example.rail',
        id: 'plugin:com.example.rail:tools',
        title: 'Tools',
        icon: 'bolt',
        contributionId: 'tools',
        order: 10
      })
    ]);

    clearPluginContributions('com.example.rail');
  });
});
