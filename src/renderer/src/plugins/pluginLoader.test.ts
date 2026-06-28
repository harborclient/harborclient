import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginContext, PluginInfo } from '#/shared/plugin/types';
import {
  disposePartialRendererActivation,
  formatPluginActivationErrorDetails,
  markPluginForThemePrompt,
  normalizePluginActivationError,
  reloadPlugin,
  unloadAllPlugins,
  unloadPlugin
} from '#/renderer/src/plugins/pluginLoader';
import {
  clearPluginContributions,
  getRegisteredSettingsSections,
  registerSettingsSectionContribution
} from '#/renderer/src/plugins/registry';
import { openPluginThemePrompt } from '#/renderer/src/store/slices/modalsSlice';

const dispatchMock = vi.fn<(action: unknown) => unknown>();

vi.mock('#/renderer/src/plugins/themeRuntime', () => ({
  applyPersistedPluginTheme: vi.fn(async () => {})
}));

vi.mock('#/renderer/src/store/redux', () => ({
  store: {
    dispatch: (action: unknown) => dispatchMock(action)
  }
}));

const FAILED_PLUGIN_ID = 'com.example.failed';
const OTHER_PLUGIN_ID = 'com.example.other';
const GATED_PLUGIN_ID = 'com.example.gated';
const THEME_PLUGIN_ID = 'com.example.theme';

const listPluginsMock = vi.fn<() => Promise<PluginInfo[]>>();
const readPluginEntryMock =
  vi.fn<(pluginId: string, kind: 'renderer' | 'main') => Promise<string>>();
const activatePluginMainMock = vi.fn<(pluginId: string) => Promise<void>>();
const deactivatePluginMainMock = vi.fn<(pluginId: string) => Promise<void>>();
const reportPluginRuntimeErrorMock =
  vi.fn<(pluginId: string, message: string | null, logDetails?: string) => Promise<PluginInfo>>();
const setPluginEnabledMock = vi.fn<(pluginId: string, enabled: boolean) => Promise<PluginInfo>>();

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
 * Plugin metadata with a contributed theme for theme prompt tests.
 */
function createThemePluginInfo(): PluginInfo {
  return {
    id: THEME_PLUGIN_ID,
    name: 'Theme Plugin',
    version: '1.0.0',
    source: 'installed',
    path: '/tmp/theme-plugin',
    enabled: true,
    permissions: ['ui'],
    manifest: {
      id: THEME_PLUGIN_ID,
      name: 'Theme Plugin',
      version: '1.0.0',
      engines: { harborclient: '>=1.0.0' },
      renderer: 'dist/renderer.js',
      permissions: ['ui'],
      contributes: {
        themes: [
          { id: 'dark', title: 'Dark', type: 'dark' },
          { id: 'light', title: 'Light', type: 'light' }
        ]
      }
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

const ACTIVATE_WITH_THEME_SOURCE = `
export function activate(hc) {
  hc.themes.register({ id: 'dark', title: 'Dark', type: 'dark' });
}
`;

const ACTIVATE_WITH_TWO_THEMES_SOURCE = `
export function activate(hc) {
  hc.themes.register({ id: 'dark', title: 'Dark', type: 'dark' });
  hc.themes.register({ id: 'light', title: 'Light', type: 'light' });
}
`;

declare global {
  var __gatedPluginActivateCalled: Record<string, boolean> | undefined;
}

const documentElementMock = {
  getAttribute: vi.fn<(name: string) => string | null>(() => null),
  setAttribute: vi.fn<(name: string, value: string) => void>(),
  removeAttribute: vi.fn<(name: string) => void>()
};

beforeEach(() => {
  globalThis.__gatedPluginActivateCalled = {};
  dispatchMock.mockReset();
  documentElementMock.getAttribute.mockReset();
  documentElementMock.setAttribute.mockReset();
  documentElementMock.removeAttribute.mockReset();
  documentElementMock.getAttribute.mockReturnValue(null);
  vi.stubGlobal('document', { documentElement: documentElementMock });
  listPluginsMock.mockReset();
  readPluginEntryMock.mockReset();
  activatePluginMainMock.mockReset();
  deactivatePluginMainMock.mockReset();
  reportPluginRuntimeErrorMock.mockReset();
  setPluginEnabledMock.mockReset();
  readPluginEntryMock.mockResolvedValue(ACTIVATE_TRACKING_SOURCE);
  activatePluginMainMock.mockResolvedValue(undefined);
  deactivatePluginMainMock.mockResolvedValue(undefined);
  reportPluginRuntimeErrorMock.mockImplementation(async (pluginId, message) => ({
    ...createGatedPluginInfo(true),
    id: pluginId,
    runtimeError: message ?? undefined
  }));
  setPluginEnabledMock.mockImplementation(async (pluginId, enabled) => ({
    ...createGatedPluginInfo(enabled),
    id: pluginId
  }));
  vi.stubGlobal('window', {
    api: {
      listPlugins: listPluginsMock,
      readPluginEntry: readPluginEntryMock,
      activatePluginMain: activatePluginMainMock,
      deactivatePluginMain: deactivatePluginMainMock,
      reportPluginRuntimeError: reportPluginRuntimeErrorMock,
      setPluginEnabled: setPluginEnabledMock
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
  clearPluginContributions(THEME_PLUGIN_ID);
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

  it('disables the plugin and reports runtime errors when renderer activation fails', async () => {
    listPluginsMock.mockResolvedValue([createGatedPluginInfo(true)]);
    readPluginEntryMock.mockResolvedValue(ACTIVATE_FAILING_SOURCE);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `data:text/javascript,${encodeURIComponent(ACTIVATE_FAILING_SOURCE.trim())}`
    );
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await expect(reloadPlugin(GATED_PLUGIN_ID)).rejects.toThrow('Renderer activate failed');

    expect(setPluginEnabledMock).toHaveBeenCalledWith(GATED_PLUGIN_ID, false);
    expect(reportPluginRuntimeErrorMock).toHaveBeenCalledWith(
      GATED_PLUGIN_ID,
      'Renderer activate failed',
      expect.stringContaining('Renderer activate failed')
    );
  });

  it('normalizes dynamic import fetch failures to a stable message', () => {
    expect(
      normalizePluginActivationError(
        new Error('Failed to fetch dynamically imported module: blob:http://localhost/abc')
      )
    ).toBe('Failed to load plugin module.');
    expect(normalizePluginActivationError(new Error('Renderer activate failed'))).toBe(
      'Renderer activate failed'
    );
  });

  it('formatPluginActivationErrorDetails includes message, stack, and cause chain', () => {
    const rootCause = new Error('Unexpected token');
    const error = new Error(
      'Failed to fetch dynamically imported module: blob:http://localhost/abc',
      {
        cause: rootCause
      }
    );
    error.stack =
      'Error: Failed to fetch dynamically imported module: blob:http://localhost/abc\n    at import';

    const details = formatPluginActivationErrorDetails(error);

    expect(details).toContain('Failed to fetch dynamically imported module: [blob URL omitted]');
    expect(details).toContain('Caused by: Unexpected token');
    expect(details).toContain('[blob URL omitted]');
  });

  it('formatPluginActivationErrorDetails stringifies non-Error throws', () => {
    expect(formatPluginActivationErrorDetails('bad plugin source')).toBe('bad plugin source');
  });

  it('reports activation failure details to the main process for terminal logging', async () => {
    listPluginsMock.mockResolvedValue([createGatedPluginInfo(true)]);
    readPluginEntryMock.mockResolvedValue(ACTIVATE_FAILING_SOURCE);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `data:text/javascript,${encodeURIComponent(ACTIVATE_FAILING_SOURCE.trim())}`
    );
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await expect(reloadPlugin(GATED_PLUGIN_ID)).rejects.toThrow('Renderer activate failed');

    expect(setPluginEnabledMock).toHaveBeenCalledWith(GATED_PLUGIN_ID, false);
    expect(reportPluginRuntimeErrorMock).toHaveBeenCalledWith(
      GATED_PLUGIN_ID,
      'Renderer activate failed',
      expect.stringContaining('Renderer activate failed')
    );
  });

  it('reports normalized Settings text with import failure details for terminal logging', () => {
    const importError = new Error(
      'Failed to fetch dynamically imported module: blob:http://localhost/abc'
    );

    expect(normalizePluginActivationError(importError)).toBe('Failed to load plugin module.');
    expect(formatPluginActivationErrorDetails(importError)).toContain('[blob URL omitted]');
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

  it('opens the theme prompt after marked activation registers themes', async () => {
    listPluginsMock.mockResolvedValue([createThemePluginInfo()]);
    readPluginEntryMock.mockResolvedValue(ACTIVATE_WITH_THEME_SOURCE);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `data:text/javascript,${encodeURIComponent(ACTIVATE_WITH_THEME_SOURCE.trim())}`
    );
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    markPluginForThemePrompt(THEME_PLUGIN_ID);
    await reloadPlugin(THEME_PLUGIN_ID);

    expect(dispatchMock).toHaveBeenCalledWith(
      openPluginThemePrompt({
        pluginId: THEME_PLUGIN_ID,
        pluginName: 'Theme Plugin',
        themes: [{ id: 'dark', title: 'Dark', type: 'dark' }]
      })
    );
  });

  it('includes every registered theme when multiple themes are contributed', async () => {
    listPluginsMock.mockResolvedValue([createThemePluginInfo()]);
    readPluginEntryMock.mockResolvedValue(ACTIVATE_WITH_TWO_THEMES_SOURCE);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `data:text/javascript,${encodeURIComponent(ACTIVATE_WITH_TWO_THEMES_SOURCE.trim())}`
    );
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    markPluginForThemePrompt(THEME_PLUGIN_ID);
    await reloadPlugin(THEME_PLUGIN_ID);

    expect(dispatchMock).toHaveBeenCalledWith(
      openPluginThemePrompt({
        pluginId: THEME_PLUGIN_ID,
        pluginName: 'Theme Plugin',
        themes: [
          { id: 'dark', title: 'Dark', type: 'dark' },
          { id: 'light', title: 'Light', type: 'light' }
        ]
      })
    );
  });

  it('does not open the theme prompt when activation was not user-marked', async () => {
    listPluginsMock.mockResolvedValue([createThemePluginInfo()]);
    readPluginEntryMock.mockResolvedValue(ACTIVATE_WITH_THEME_SOURCE);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `data:text/javascript,${encodeURIComponent(ACTIVATE_WITH_THEME_SOURCE.trim())}`
    );
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    await reloadPlugin(THEME_PLUGIN_ID);

    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('does not open the theme prompt when the plugin theme is already active', async () => {
    listPluginsMock.mockResolvedValue([createThemePluginInfo()]);
    readPluginEntryMock.mockResolvedValue(ACTIVATE_WITH_THEME_SOURCE);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      () => `data:text/javascript,${encodeURIComponent(ACTIVATE_WITH_THEME_SOURCE.trim())}`
    );
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    documentElementMock.getAttribute.mockReturnValue(`plugin-${THEME_PLUGIN_ID}-dark`);

    markPluginForThemePrompt(THEME_PLUGIN_ID);
    await reloadPlugin(THEME_PLUGIN_ID);

    expect(dispatchMock).not.toHaveBeenCalled();
  });
});
