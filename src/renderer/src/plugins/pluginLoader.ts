import type { PluginContext, PluginInfo } from '#/shared/plugin/types';
import { createPluginContext } from '#/renderer/src/plugins/createPluginContext';
import { clearPluginContributions } from '#/renderer/src/plugins/registry';
import { applyPersistedPluginTheme } from '#/renderer/src/plugins/themeRuntime';

interface LoadedPlugin {
  pluginId: string;
  deactivate?: () => void;
  disposables: Array<{ dispose: () => void }>;
}

const loaded = new Map<string, LoadedPlugin>();

/**
 * Dynamically imports a plugin bundle from source text.
 *
 * @param source - Bundled ESM source returned by the main process.
 */
async function importPluginModule(
  source: string
): Promise<{ activate?: (hc: unknown) => void | Promise<void>; deactivate?: () => void }> {
  const blob = new Blob([source], { type: 'text/javascript' });
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

/**
 * Persists an activation failure so Settings can show the runtime error.
 *
 * @param pluginId - Plugin manifest id.
 * @param error - Thrown activation error.
 */
async function reportActivationFailure(pluginId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  try {
    await window.api.reportPluginRuntimeError(pluginId, message);
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
    await clearActivationError(plugin.id);
  } catch (error) {
    await reportActivationFailure(plugin.id, error);
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
