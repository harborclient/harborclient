import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '#/shared/plugin/databaseTypes';
import type { PluginManifest } from '#/shared/plugin/types';
import { createPluginContext } from '#/renderer/src/plugins/createPluginContext';
import {
  clearPluginAfterSendSubscribers,
  emitPluginAfterSend
} from '#/renderer/src/plugins/pluginAfterSendBus';

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

  vi.stubGlobal('window', {
    api: {
      invokePluginMain: invokePluginMainMock,
      activatePluginMain: activatePluginMainMock,
      pushPluginHttpAfterSend: vi.fn().mockResolvedValue(undefined)
    }
  });
});

afterEach(() => {
  clearPluginAfterSendSubscribers();
  vi.unstubAllGlobals();
});

describe('createPluginContext runtime surfaces', () => {
  it('exposes hc.http.onAfterSend when the http permission is granted', async () => {
    const hc = createPluginContext('com.example.test', createManifest(['http']));
    const handler = vi.fn();
    hc.subscriptions.push(hc.http.onAfterSend(handler));

    emitPluginAfterSend(
      { method: 'GET', url: 'https://example.com', headers: {}, body: '' },
      { status: 200, statusText: 'OK', headers: {}, body: '' }
    );

    await Promise.resolve();
    expect(handler).toHaveBeenCalledTimes(1);
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
    await expect(hc.host.sendRequest()).rejects.toThrow(/lacks permission: ui/);
    await expect(hc.host.createEnvironmentWithVariables('Dev', [])).rejects.toThrow(
      /lacks permission: ui/
    );
    await expect(hc.host.updateEnvironmentVariables(1, [])).rejects.toThrow(/lacks permission: ui/);
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
});
