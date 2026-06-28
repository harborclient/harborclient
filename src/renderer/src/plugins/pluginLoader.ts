import type { PluginContext, PluginInfo } from '#/shared/plugin/types';
import { createPluginContext } from '#/renderer/src/plugins/createPluginContext';
import {
  clearPluginContributions,
  getRegisteredPluginThemes
} from '#/renderer/src/plugins/registry';
import { applyPersistedPluginTheme } from '#/renderer/src/plugins/themeRuntime';
import { store } from '#/renderer/src/store/redux';
import { openPluginThemePrompt } from '#/renderer/src/store/slices/modalsSlice';

interface LoadedPlugin {
  pluginId: string;
  deactivate?: () => void;
  disposables: Array<{ dispose: () => void }>;
}

const loaded = new Map<string, LoadedPlugin>();

/** Plugin ids queued for a post-activation theme switch prompt. */
const pendingThemePromptIds = new Set<string>();

/** Module URL plugins use when their bundle externalizes bare `react` imports. */
const PLUGIN_REACT_SHIM = new URL('./shims/react.ts', import.meta.url).href;

/** Module URL plugins use when their bundle externalizes bare `react-dom` imports. */
const PLUGIN_REACT_DOM_SHIM = new URL('./shims/react-dom.ts', import.meta.url).href;

/**
 * Rewrites externalized React imports in a plugin bundle to host shim modules.
 *
 * Plugin esbuild configs mark `react` and `react-dom` as external, but dependencies
 * bundled into the plugin (for example Font Awesome or CodeMirror) still emit bare
 * `react` specifiers. Blob URL dynamic imports cannot resolve those without a map.
 *
 * @param source - Bundled plugin ESM source text.
 * @returns Source with `react` / `react-dom` imports pointed at host shims.
 */
function patchPluginReactImports(source: string): string {
  return source
    .replace(/from\s*(["'])react\1/g, `from ${JSON.stringify(PLUGIN_REACT_SHIM)}`)
    .replace(/from\s*(["'])react-dom\1/g, `from ${JSON.stringify(PLUGIN_REACT_DOM_SHIM)}`);
}

/**
 * Dynamically imports a plugin bundle from source text.
 *
 * @param source - Bundled ESM source returned by the main process.
 */
async function importPluginModule(
  source: string
): Promise<{ activate?: (hc: unknown) => void | Promise<void>; deactivate?: () => void }> {
  const patched = patchPluginReactImports(source);
  const blob = new Blob([patched], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    return (await import(/* @vite-ignore */ url)) as {
      activate?: (hc: unknown) => void | Promise<void>;
      deactivate?: () => void;
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Stable runtime error text for blob-URL dynamic import failures. */
const PLUGIN_MODULE_IMPORT_ERROR = 'Failed to load plugin module.';

/** Matches unique blob URLs appended to dynamic import failure messages. */
const DYNAMIC_IMPORT_BLOB_URL_PATTERN = /:\s*blob:[^\s)]+/g;

/**
 * Replaces unstable blob URLs in error text so terminal logs stay readable.
 *
 * @param text - Raw error message or stack line.
 * @returns Text with blob URLs replaced by a stable placeholder.
 */
function omitBlobUrlsFromErrorText(text: string): string {
  return text.replace(DYNAMIC_IMPORT_BLOB_URL_PATTERN, ': [blob URL omitted]');
}

/**
 * Formats an activation error for terminal logging, including nested causes.
 *
 * @param error - Thrown activation error.
 * @returns Multi-line detail string with message, stack, and cause chain.
 */
export function formatPluginActivationErrorDetails(error: unknown): string {
  const lines: string[] = [];
  let current: unknown = error;
  let depth = 0;

  while (current !== undefined && current !== null && depth < 8) {
    if (current instanceof Error) {
      lines.push(
        depth === 0
          ? omitBlobUrlsFromErrorText(current.message)
          : `Caused by: ${omitBlobUrlsFromErrorText(current.message)}`
      );
      if (depth === 0 && current.stack) {
        lines.push(omitBlobUrlsFromErrorText(current.stack));
      }
      current = current.cause;
    } else {
      lines.push(depth === 0 ? String(current) : `Caused by: ${String(current)}`);
      current = undefined;
    }
    depth += 1;
  }

  return lines.join('\n');
}

/**
 * Normalizes activation error messages for persistence.
 *
 * Dynamic import failures include a unique blob URL on each attempt, which
 * would otherwise bypass deduplication in the main process and re-trigger reload.
 *
 * @param error - Thrown activation error.
 * @returns Message suitable for Settings and runtime-error deduplication.
 */
export function normalizePluginActivationError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('Failed to fetch dynamically imported module')) {
    return PLUGIN_MODULE_IMPORT_ERROR;
  }
  return message;
}

/**
 * Disables a plugin and persists its activation failure for Settings.
 *
 * Disabling first breaks the renderer reload loop triggered by runtime-error
 * updates; a stable normalized message avoids repeated change events on retry.
 *
 * @param plugin - Plugin metadata from the main process.
 * @param error - Thrown activation error.
 */
async function handleActivationFailure(plugin: PluginInfo, error: unknown): Promise<void> {
  const message = normalizePluginActivationError(error);
  const logDetails = formatPluginActivationErrorDetails(error);
  try {
    await window.api.setPluginEnabled(plugin.id, false);
  } catch {
    // Best-effort disable when activation fails.
  }
  try {
    await window.api.reportPluginRuntimeError(plugin.id, message, logDetails);
  } catch {
    // Best-effort persistence for Settings display.
  }
}

/**
 * Clears a stale runtime error after successful activation.
 *
 * @param pluginId - Plugin manifest id.
 */
async function clearActivationError(pluginId: string): Promise<void> {
  try {
    await window.api.reportPluginRuntimeError(pluginId, null);
  } catch {
    // Best-effort clear when the main process is unavailable.
  }
}

/**
 * Marks a plugin for a theme switch prompt after the next successful activation.
 *
 * Call this immediately before enabling a plugin when the user opts in to trying
 * its contributed themes.
 *
 * @param pluginId - Plugin manifest id.
 */
export function markPluginForThemePrompt(pluginId: string): void {
  pendingThemePromptIds.add(pluginId);
}

/**
 * Opens the theme switch prompt when the user just enabled a plugin that registered themes.
 *
 * @param plugin - Plugin metadata from the main process.
 */
function maybePromptForPluginTheme(plugin: PluginInfo): void {
  if (!pendingThemePromptIds.delete(plugin.id)) {
    return;
  }

  const themes = getRegisteredPluginThemes()
    .filter((entry) => entry.pluginId === plugin.id)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      type: entry.type
    }));

  if (themes.length === 0) {
    return;
  }

  const activeDataTheme = document.documentElement.getAttribute('data-theme');
  const alreadyActive = themes.some(
    (theme) => activeDataTheme === `plugin-${plugin.id}-${theme.id}`
  );
  if (alreadyActive) {
    return;
  }

  store.dispatch(
    openPluginThemePrompt({
      pluginId: plugin.id,
      pluginName: plugin.name,
      themes
    })
  );
}

/**
 * Tears down partial renderer activation after activate() throws before load completes.
 *
 * @param pluginId - Plugin manifest id.
 * @param hc - Activation context whose subscriptions may hold partial resources.
 * @param module - Imported plugin module that may export deactivate().
 */
export async function disposePartialRendererActivation(
  pluginId: string,
  hc: PluginContext,
  module: { deactivate?: () => void }
): Promise<void> {
  try {
    module.deactivate?.();
  } catch {
    // Plugin deactivate may fail during partial activation.
  }
  for (const disposable of hc.subscriptions) {
    try {
      disposable.dispose();
    } catch {
      // Ignore dispose errors during rollback.
    }
  }
  clearPluginContributions(pluginId);
  await applyPersistedPluginTheme();
}

/**
 * Deactivates and unloads one plugin from the renderer host.
 *
 * @param pluginId - Plugin manifest id.
 */
export async function unloadPlugin(pluginId: string): Promise<void> {
  const entry = loaded.get(pluginId);
  if (!entry) {
    clearPluginContributions(pluginId);
    return;
  }
  entry.deactivate?.();
  for (const disposable of entry.disposables) {
    disposable.dispose();
  }
  clearPluginContributions(pluginId);
  if (entry.pluginId) {
    try {
      await window.api.deactivatePluginMain(pluginId);
    } catch {
      // Main entry may not have been active.
    }
  }
  loaded.delete(pluginId);
  await applyPersistedPluginTheme();
}

/**
 * Activates one enabled plugin in the renderer host.
 *
 * @param plugin - Plugin metadata from the main process.
 */
async function loadPlugin(plugin: PluginInfo): Promise<void> {
  if (!plugin.enabled || plugin.error) {
    return;
  }

  await unloadPlugin(plugin.id);

  try {
    if (!plugin.manifest.renderer) {
      if (plugin.manifest.main) {
        await window.api.activatePluginMain(plugin.id);
      }
      await clearActivationError(plugin.id);
      return;
    }

    const source = await window.api.readPluginEntry(plugin.id, 'renderer');
    const module = await importPluginModule(source);
    if (typeof module.activate !== 'function') {
      throw new Error(`Plugin ${plugin.id} renderer entry must export activate(hc).`);
    }

    const hc = createPluginContext(plugin.id, plugin.manifest);
    try {
      await module.activate(hc);
    } catch (error) {
      await disposePartialRendererActivation(plugin.id, hc, module);
      throw error;
    }
    loaded.set(plugin.id, {
      pluginId: plugin.id,
      deactivate: module.deactivate,
      disposables: [...hc.subscriptions]
    });

    if (plugin.manifest.main) {
      await window.api.activatePluginMain(plugin.id);
    }

    await applyPersistedPluginTheme();
    maybePromptForPluginTheme(plugin);
    await clearActivationError(plugin.id);
  } catch (error) {
    await handleActivationFailure(plugin, error);
    throw error;
  }
}

/**
 * Reloads all enabled plugins from disk.
 */
export async function reloadAllPlugins(): Promise<void> {
  const plugins = await window.api.listPlugins();
  for (const plugin of plugins) {
    if (plugin.enabled) {
      try {
        await loadPlugin(plugin);
      } catch {
        // Error already reported; continue loading other plugins.
      }
    } else {
      await unloadPlugin(plugin.id);
    }
  }
}

/**
 * Reloads one plugin by id.
 *
 * @param pluginId - Plugin manifest id.
 */
export async function reloadPlugin(pluginId: string): Promise<void> {
  const plugins = await window.api.listPlugins();
  const plugin = plugins.find((entry) => entry.id === pluginId);
  if (!plugin || !plugin.enabled) {
    await unloadPlugin(pluginId);
    return;
  }
  await loadPlugin(plugin);
}

/**
 * Unloads every plugin currently held by the renderer host.
 */
export async function unloadAllPlugins(): Promise<void> {
  for (const pluginId of [...loaded.keys()]) {
    await unloadPlugin(pluginId);
  }
}
