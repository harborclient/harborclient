import { describe, expect, it, vi } from 'vitest';
import { applyContributionMessage, handlePluginHostBridgeInvoke } from './pluginBridgeHost';
import * as hostCommands from './hostCommands';
import * as hostRequestCommands from './hostRequestCommands';
import { clearPluginContributions, getRegisteredPluginThemes } from './registry';

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
});
