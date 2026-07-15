import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginInfo } from '#/shared/plugin/types';
import {
  AGENT_READY_TIMEOUT_MS,
  MAX_AGENT_ACTIVATION_ATTEMPTS,
  clearPendingThemePrompt,
  disposePartialRendererActivation,
  formatPluginActivationErrorDetails,
  isPendingThemePrompt,
  markPluginForThemePrompt,
  normalizePluginActivationError,
  notifyAgentReady,
  reloadPlugin,
  takePendingThemePromptPluginIds,
  unloadAllPlugins,
  unloadPlugin,
  resetPluginLoaderForTests
} from './pluginLoader';
import {
  clearPluginContributions,
  getRegisteredSettingsSections,
  registerSettingsSectionContribution
} from './registry';

const FAILED_PLUGIN_ID = 'com.example.failed';
const GATED_PLUGIN_ID = 'com.example.gated';

const listPluginsMock = vi.fn<() => Promise<PluginInfo[]>>();
const activatePluginMainMock = vi.fn<(pluginId: string) => Promise<void>>();
const deactivatePluginMainMock = vi.fn<(pluginId: string) => Promise<void>>();
const reportPluginRuntimeErrorMock =
  vi.fn<(pluginId: string, message: string | null, logDetails?: string) => Promise<PluginInfo>>();
const setPluginEnabledMock = vi.fn<(pluginId: string, enabled: boolean) => Promise<PluginInfo>>();

const createdWebviews: Array<{ remove: ReturnType<typeof vi.fn>; src: string }> = [];

/** Mount count at which the mock agent webview reports ready (test hook). */
let notifyAgentReadyAfterMountCount = 1;

/**
 * Records one mock webview mount and optionally resolves the pending agent-ready waiter.
 *
 * @param webview - Mock webview instance.
 * @param value - Assigned src URL.
 * @param mountCountRef - Mutable mount counter for the current test.
 */
function recordMockWebviewMount(
  webview: { remove: ReturnType<typeof vi.fn> },
  value: string,
  mountCountRef: { count: number }
): void {
  mountCountRef.count += 1;
  createdWebviews.push({ remove: webview.remove, src: value });
  if (mountCountRef.count >= notifyAgentReadyAfterMountCount) {
    queueMicrotask(() => notifyAgentReady(GATED_PLUGIN_ID));
  }
}

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

const agentContainer = {
  id: 'plugin-agent-webviews',
  appendChild: vi.fn(),
  remove: vi.fn()
};

beforeEach(() => {
  createdWebviews.length = 0;
  notifyAgentReadyAfterMountCount = 1;
  const mountCountRef = { count: 0 };
  agentContainer.appendChild.mockReset();
  listPluginsMock.mockReset();
  activatePluginMainMock.mockReset();
  deactivatePluginMainMock.mockReset();
  reportPluginRuntimeErrorMock.mockReset();
  setPluginEnabledMock.mockReset();
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

  const createElement = vi.fn((tagName: string) => {
    if (tagName === 'div') {
      return { id: '', appendChild: vi.fn(), style: {} } as unknown as HTMLElement;
    }
    if (tagName !== 'webview') {
      throw new Error(`Unexpected tag: ${tagName}`);
    }
    const webview = {
      src: '',
      partition: '',
      remove: vi.fn(),
      style: {} as CSSStyleDeclaration,
      setAttribute: vi.fn((name: string, value: string) => {
        if (name === 'src') {
          recordMockWebviewMount(webview, value, mountCountRef);
        }
      }),
      addEventListener: vi.fn()
    };
    Object.defineProperty(webview, 'src', {
      set(value: string) {
        recordMockWebviewMount(webview, value, mountCountRef);
      },
      get() {
        return createdWebviews.at(-1)?.src ?? '';
      }
    });
    return webview as unknown as Electron.WebviewTag;
  });

  vi.stubGlobal('document', {
    createElement,
    body: { appendChild: vi.fn() },
    getElementById: vi.fn((id: string) => (id === 'plugin-agent-webviews' ? agentContainer : null)),
    documentElement: {
      getAttribute: vi.fn(() => null),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn()
    }
  });

  vi.stubGlobal('window', {
    api: {
      listPlugins: listPluginsMock,
      activatePluginMain: activatePluginMainMock,
      deactivatePluginMain: deactivatePluginMainMock,
      reportPluginRuntimeError: reportPluginRuntimeErrorMock,
      setPluginEnabled: setPluginEnabledMock,
      getTheme: vi.fn(async () => 'system'),
      getCustomTheme: vi.fn(async () => null),
      onPluginsAgentReady: vi.fn(() => () => {}),
      onPluginsAgentFailed: vi.fn(() => () => {})
    }
  });
});

afterEach(async () => {
  resetPluginLoaderForTests();
  await unloadAllPlugins();
  vi.unstubAllGlobals();
  clearPluginContributions(FAILED_PLUGIN_ID);
  clearPluginContributions(GATED_PLUGIN_ID);
});

describe('pluginLoader', () => {
  it('reloadPlugin does not mount agent webviews for disabled plugins', async () => {
    listPluginsMock.mockResolvedValue([createGatedPluginInfo(false)]);

    await reloadPlugin(GATED_PLUGIN_ID);

    expect(createdWebviews).toHaveLength(0);
  });

  it('reloadPlugin mounts an agent webview for enabled plugins', async () => {
    listPluginsMock.mockResolvedValue([createGatedPluginInfo(true)]);

    await reloadPlugin(GATED_PLUGIN_ID);

    expect(createdWebviews).toHaveLength(1);
    expect(createdWebviews[0]?.src).toContain(GATED_PLUGIN_ID);
    expect(reportPluginRuntimeErrorMock).toHaveBeenCalledWith(GATED_PLUGIN_ID, null);
  });

  it('reloadPlugin remounts the agent webview and succeeds on a later attempt', async () => {
    vi.useFakeTimers();
    try {
      notifyAgentReadyAfterMountCount = 2;
      listPluginsMock.mockResolvedValue([createGatedPluginInfo(true)]);

      const reloadPromise = reloadPlugin(GATED_PLUGIN_ID);
      await Promise.all([vi.advanceTimersByTimeAsync(AGENT_READY_TIMEOUT_MS), reloadPromise]);

      expect(createdWebviews.length).toBeGreaterThanOrEqual(2);
      expect(setPluginEnabledMock).not.toHaveBeenCalledWith(GATED_PLUGIN_ID, false);
      expect(reportPluginRuntimeErrorMock).toHaveBeenCalledWith(GATED_PLUGIN_ID, null);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reloadPlugin disables the plugin after exhausting agent activation retries', async () => {
    vi.useFakeTimers();
    try {
      notifyAgentReadyAfterMountCount = Number.MAX_SAFE_INTEGER;
      listPluginsMock.mockResolvedValue([createGatedPluginInfo(true)]);

      const reloadPromise = reloadPlugin(GATED_PLUGIN_ID);
      const timerPromise = (async () => {
        for (let attempt = 0; attempt < MAX_AGENT_ACTIVATION_ATTEMPTS; attempt += 1) {
          await vi.advanceTimersByTimeAsync(AGENT_READY_TIMEOUT_MS);
        }
      })();
      await expect(Promise.all([timerPromise, reloadPromise])).rejects.toThrow(
        /timed out \(last phase:/
      );

      expect(createdWebviews.length).toBeGreaterThanOrEqual(MAX_AGENT_ACTIVATION_ATTEMPTS);
      expect(setPluginEnabledMock).toHaveBeenCalledWith(GATED_PLUGIN_ID, false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('normalizes dynamic import fetch failures to a stable message', () => {
    expect(
      normalizePluginActivationError(
        new Error('Failed to fetch dynamically imported module: blob:http://localhost/abc')
      )
    ).toBe('Failed to load plugin module.');
  });

  it('formatPluginActivationErrorDetails includes message, stack, and cause chain', () => {
    const rootCause = new Error('Unexpected token');
    const error = new Error('Renderer activate failed', { cause: rootCause });
    error.stack = 'Error: Renderer activate failed\n    at activate';

    const details = formatPluginActivationErrorDetails(error);

    expect(details).toContain('Renderer activate failed');
    expect(details).toContain('Caused by: Unexpected token');
  });

  it('unloadPlugin clears orphan contributions when the plugin is not loaded', async () => {
    registerSettingsSectionContribution(FAILED_PLUGIN_ID, {
      id: 'plugin:com.example.failed:general',
      title: 'Example',
      contributionId: 'general'
    });

    await unloadPlugin(FAILED_PLUGIN_ID);

    expect(
      getRegisteredSettingsSections().some((section) => section.pluginId === FAILED_PLUGIN_ID)
    ).toBe(false);
  });

  it('disposePartialRendererActivation clears contributions for one plugin', async () => {
    registerSettingsSectionContribution(FAILED_PLUGIN_ID, {
      id: 'plugin:com.example.failed:general',
      title: 'Example',
      contributionId: 'general'
    });

    await disposePartialRendererActivation(FAILED_PLUGIN_ID);

    expect(
      getRegisteredSettingsSections().some((section) => section.pluginId === FAILED_PLUGIN_ID)
    ).toBe(false);
  });

  it('markPluginForThemePrompt queues and takePendingThemePromptPluginIds clears pending ids', () => {
    expect(isPendingThemePrompt(GATED_PLUGIN_ID)).toBe(false);

    markPluginForThemePrompt(GATED_PLUGIN_ID);
    expect(isPendingThemePrompt(GATED_PLUGIN_ID)).toBe(true);

    expect(takePendingThemePromptPluginIds()).toEqual([GATED_PLUGIN_ID]);
    expect(isPendingThemePrompt(GATED_PLUGIN_ID)).toBe(false);
  });

  it('clearPendingThemePrompt removes one pending theme prompt mark', () => {
    markPluginForThemePrompt(GATED_PLUGIN_ID);
    clearPendingThemePrompt(GATED_PLUGIN_ID);
    expect(isPendingThemePrompt(GATED_PLUGIN_ID)).toBe(false);
  });
});
