import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginContext, PluginInfo } from '#/shared/plugin/types';
import {
  disposePartialRendererActivation,
  reloadPlugin,
  unloadAllPlugins,
  unloadPlugin
} from '#/renderer/src/plugins/pluginLoader';
import {
  clearPluginContributions,
  getRegisteredSettingsSections,
  registerSettingsSectionContribution
} from '#/renderer/src/plugins/registry';

vi.mock('#/renderer/src/plugins/themeRuntime', () => ({
  applyPersistedPluginTheme: vi.fn(async () => {})
}));

const FAILED_PLUGIN_ID = 'com.example.failed';
const OTHER_PLUGIN_ID = 'com.example.other';
const GATED_PLUGIN_ID = 'com.example.gated';

const listPluginsMock = vi.fn<() => Promise<PluginInfo[]>>();
const readPluginEntryMock =
  vi.fn<(pluginId: string, kind: 'renderer' | 'main') => Promise<string>>();
const activatePluginMainMock = vi.fn<(pluginId: string) => Promise<void>>();
const deactivatePluginMainMock = vi.fn<(pluginId: string) => Promise<void>>();
const reportPluginRuntimeErrorMock =
  vi.fn<(pluginId: string, message: string | null) => Promise<PluginInfo>>();

/**
 * Minimal plugin metadata used by reloadPlugin gating tests.
 */
function createGatedPluginInfo(enabled: boolean): PluginInfo {
  return {
    id: GATED_PLUGIN_ID,
    name: 'Gated Plugin',
    version: '1.0.0',
    source: 'installed',
    path: '/tmp/gated-plugin',
    enabled,
    permissions: ['ui'],
    manifest: {
      id: GATED_PLUGIN_ID,
      name: 'Gated Plugin',
      version: '1.0.0',
      engines: { harborclient: '>=1.0.0' },
      renderer: 'dist/renderer.js',
      permissions: ['ui']
    }
  };
}

/**
 * Renderer entry source that records whether activate() ran.
 */
const ACTIVATE_TRACKING_SOURCE = `
globalThis.__gatedPluginActivateCalled = globalThis.__gatedPluginActivateCalled ?? {};
export function activate() {
  globalThis.__gatedPluginActivateCalled['${GATED_PLUGIN_ID}'] = true;
}
`;

const ACTIVATE_FAILING_SOURCE = `
export function activate() {
  throw new Error('Renderer activate failed');
}
`;

declare global {
  var __gatedPluginActivateCalled: Record<string, boolean> | undefined;
}

beforeEach(() => {
  globalThis.__gatedPluginActivateCalled = {};
  listPluginsMock.mockReset();
  readPluginEntryMock.mockReset();
  activatePluginMainMock.mockReset();
  deactivatePluginMainMock.mockReset();
  reportPluginRuntimeErrorMock.mockReset();
  readPluginEntryMock.mockResolvedValue(ACTIVATE_TRACKING_SOURCE);
  activatePluginMainMock.mockResolvedValue(undefined);
  deactivatePluginMainMock.mockResolvedValue(undefined);
  reportPluginRuntimeErrorMock.mockImplementation(async (pluginId, message) => ({
    ...createGatedPluginInfo(true),
    id: pluginId,
    runtimeError: message ?? undefined
  }));
  vi.stubGlobal('window', {
    api: {
      listPlugins: listPluginsMock,
      readPluginEntry: readPluginEntryMock,
      activatePluginMain: activatePluginMainMock,
      deactivatePluginMain: deactivatePluginMainMock,
      reportPluginRuntimeError: reportPluginRuntimeErrorMock
    }
  });
});

afterEach(async () => {
  await unloadAllPlugins();
  vi.unstubAllGlobals();
  delete globalThis.__gatedPluginActivateCalled;
});

/**
 * Minimal React component stub for plugin loader tests.
 */
function StubSection(): null {
  return null;
}

/**
 * Removes test plugin contributions left in the shared registry.
 */
function cleanupTestContributions(): void {
  clearPluginContributions(FAILED_PLUGIN_ID);
  clearPluginContributions(OTHER_PLUGIN_ID);
  clearPluginContributions(GATED_PLUGIN_ID);
}

describe('pluginLoader', () => {
  afterEach(() => {
    cleanupTestContributions();
  });

  it('reloadPlugin does not activate disabled plugins', async () => {
    listPluginsMock.mockResolvedValue([createGatedPluginInfo(false)]);

    await reloadPlugin(GATED_PLUGIN_ID);

    expect(readPluginEntryMock).not.toHaveBeenCalled();
    expect(globalThis.__gatedPluginActivateCalled?.[GATED_PLUGIN_ID]).toBeUndefined();
  });

  it('reloadPlugin activates enabled plugins', async () => {
    listPluginsMock.mockResolvedValue([createGatedPluginInfo(true)]);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `data:text/javascript,${encodeURIComponent(ACTIVATE_TRACKING_SOURCE.trim())}`
    );
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await reloadPlugin(GATED_PLUGIN_ID);

    expect(readPluginEntryMock).toHaveBeenCalledWith(GATED_PLUGIN_ID, 'renderer');
    expect(globalThis.__gatedPluginActivateCalled?.[GATED_PLUGIN_ID]).toBe(true);
    expect(reportPluginRuntimeErrorMock).toHaveBeenCalledWith(GATED_PLUGIN_ID, null);
  });

  it('reports runtime errors when renderer activation fails', async () => {
    listPluginsMock.mockResolvedValue([createGatedPluginInfo(true)]);
    readPluginEntryMock.mockResolvedValue(ACTIVATE_FAILING_SOURCE);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `data:text/javascript,${encodeURIComponent(ACTIVATE_FAILING_SOURCE.trim())}`
    );
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await expect(reloadPlugin(GATED_PLUGIN_ID)).rejects.toThrow('Renderer activate failed');

    expect(reportPluginRuntimeErrorMock).toHaveBeenCalledWith(
      GATED_PLUGIN_ID,
      'Renderer activate failed'
    );
  });

  it('unloadPlugin clears orphan contributions when the plugin is not loaded', async () => {
    registerSettingsSectionContribution(FAILED_PLUGIN_ID, {
      id: 'plugin:com.example.failed:general',
      title: 'Example',
      Component: StubSection
    });
    expect(
      getRegisteredSettingsSections().some((section) => section.pluginId === FAILED_PLUGIN_ID)
    ).toBe(true);

    await unloadPlugin(FAILED_PLUGIN_ID);

    expect(
      getRegisteredSettingsSections().some((section) => section.pluginId === FAILED_PLUGIN_ID)
    ).toBe(false);
  });

  it('disposePartialRendererActivation clears contributions and disposes subscriptions', async () => {
    registerSettingsSectionContribution(FAILED_PLUGIN_ID, {
      id: 'plugin:com.example.failed:general',
      title: 'Example',
      Component: StubSection
    });

    let disposed = false;
    const hc = {
      subscriptions: [
        {
          dispose: () => {
            disposed = true;
          }
        }
      ]
    } as PluginContext;

    await disposePartialRendererActivation(FAILED_PLUGIN_ID, hc, {});

    expect(disposed).toBe(true);
    expect(
      getRegisteredSettingsSections().some((section) => section.pluginId === FAILED_PLUGIN_ID)
    ).toBe(false);
  });
});
