import { describe, expect, it, vi } from 'vitest';
import {
  applyContributionMessage,
  handlePluginHostBridgeInvoke
} from '#/renderer/src/plugins/pluginBridgeHost';
import * as hostRequestCommands from '#/renderer/src/plugins/hostRequestCommands';
import {
  clearPluginContributions,
  getRegisteredPluginThemes
} from '#/renderer/src/plugins/registry';

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
