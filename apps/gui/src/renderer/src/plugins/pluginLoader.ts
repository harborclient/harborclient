import type { PluginInfo } from '#/shared/plugin/types';
import { buildPluginAgentUrl } from '#/shared/plugin/pluginSurface';
import { clearPluginContributions, registerThemeContribution } from './registry';
import { clearPluginImportHandlers } from './pluginImportHandlers';
import { applyPersistedPluginTheme } from './themeRuntime';

/** Tracks hidden agent webviews mounted for enabled plugins. */
const agentWebviews = new Map<string, Electron.WebviewTag>();

/** Plugin ids queued for a post-activation theme switch toast. */
const pendingThemePromptIds = new Set<string>();

/** Pending agent-ready promises keyed by plugin id. */
const agentReadyWaiters = new Map<
  string,
  { resolve: () => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }
>();

/** Last observed load phase per plugin agent webview. */
const agentLoadPhases = new Map<string, AgentLoadPhase>();

/** Guest lifecycle phases tracked while an agent webview boots. */
export type AgentLoadPhase = 'mounted' | 'dom-ready' | 'finished' | 'ready';

/** Maximum time to wait for one agent activation attempt. */
export const AGENT_READY_TIMEOUT_MS = 12000;

/** Maximum agent webview mount attempts before reporting activation failure. */
export const MAX_AGENT_ACTIVATION_ATTEMPTS = 3;

/**
 * Records the current agent webview load phase for diagnostics and timeout messages.
 *
 * @param pluginId - Plugin manifest id.
 * @param phase - Latest lifecycle phase.
 */
function setAgentLoadPhase(pluginId: string, phase: AgentLoadPhase): void {
  agentLoadPhases.set(pluginId, phase);
}

/**
 * Returns the last recorded agent load phase for one plugin.
 *
 * @param pluginId - Plugin manifest id.
 */
function getAgentLoadPhase(pluginId: string): AgentLoadPhase | undefined {
  return agentLoadPhases.get(pluginId);
}

/**
 * Clears a pending agent-ready waiter without rejecting it.
 *
 * Used when abandoning a mount attempt before its timeout fires.
 *
 * @param pluginId - Plugin manifest id.
 */
function cancelAgentReadyWait(pluginId: string): void {
  const waiter = agentReadyWaiters.get(pluginId);
  if (!waiter) {
    return;
  }
  clearTimeout(waiter.timeout);
  agentReadyWaiters.delete(pluginId);
}

/**
 * Waits until the plugin agent webview reports successful activation.
 *
 * @param pluginId - Plugin manifest id.
 * @param timeoutMs - Per-attempt timeout in milliseconds.
 */
function waitForAgentReady(
  pluginId: string,
  timeoutMs: number = AGENT_READY_TIMEOUT_MS
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const pending = agentReadyWaiters.get(pluginId);
      if (!pending || pending.timeout !== timeout) {
        return;
      }
      agentReadyWaiters.delete(pluginId);
      const phase = getAgentLoadPhase(pluginId) ?? 'mounted';
      reject(new Error(`Plugin ${pluginId} agent webview timed out (last phase: ${phase}).`));
    }, timeoutMs);
    agentReadyWaiters.set(pluginId, { resolve, reject, timeout });
  });
}

/**
 * Resolves a pending agent-ready waiter when the broker notifies the host.
 *
 * @param pluginId - Plugin manifest id.
 */
export function notifyAgentReady(pluginId: string): void {
  setAgentLoadPhase(pluginId, 'ready');
  const waiter = agentReadyWaiters.get(pluginId);
  if (!waiter) {
    return;
  }
  clearTimeout(waiter.timeout);
  agentReadyWaiters.delete(pluginId);
  waiter.resolve();
}

/**
 * Creates or returns the hidden container used for plugin agent webviews.
 *
 * Agent webviews must not live under `display: none`; Electron may never load
 * their guest documents in that state. Keep the container in-viewport and
 * composited, but clip it to zero visible pixels so Blink does not throttle
 * the guest renderer the way off-screen or zero-opacity placement can.
 */
function ensureAgentContainer(): HTMLElement {
  let container = document.getElementById('plugin-agent-webviews');
  if (!container) {
    container = document.createElement('div');
    container.id = 'plugin-agent-webviews';
    container.style.position = 'fixed';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = '640px';
    container.style.height = '480px';
    container.style.overflow = 'hidden';
    container.style.clipPath = 'inset(100%)';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Rejects a pending agent-ready waiter when the agent webview fails to load.
 *
 * @param pluginId - Plugin manifest id.
 * @param message - Failure description for Settings and logs.
 */
export function rejectAgentReady(pluginId: string, message: string): void {
  const waiter = agentReadyWaiters.get(pluginId);
  if (!waiter) {
    return;
  }
  clearTimeout(waiter.timeout);
  agentReadyWaiters.delete(pluginId);
  waiter.reject(new Error(message));
}

/**
 * Logs one agent webview lifecycle event with elapsed time since mount.
 *
 * @param pluginId - Plugin manifest id.
 * @param mountStartedAt - Timestamp when the webview was created.
 * @param event - Lifecycle event name.
 * @param detail - Optional structured detail for the log line.
 */
function logAgentWebviewLifecycle(
  pluginId: string,
  mountStartedAt: number,
  event: string,
  detail?: Record<string, unknown>
): void {
  const elapsedMs = Date.now() - mountStartedAt;
  if (detail && Object.keys(detail).length > 0) {
    console.debug(`[plugin agent ${pluginId}] +${elapsedMs}ms ${event}`, detail);
    return;
  }
  console.debug(`[plugin agent ${pluginId}] +${elapsedMs}ms ${event}`);
}

/**
 * Mounts the hidden agent webview for one plugin if it is not already present.
 *
 * @param plugin - Plugin metadata from the main process.
 */
function mountAgentWebview(plugin: PluginInfo): void {
  if (!plugin.manifest.renderer || agentWebviews.has(plugin.id)) {
    return;
  }

  const mountStartedAt = Date.now();
  setAgentLoadPhase(plugin.id, 'mounted');

  const agentUrl = buildPluginAgentUrl(plugin.id);
  const webview = document.createElement('webview') as Electron.WebviewTag;
  webview.setAttribute('src', agentUrl);
  webview.partition = `persist:plugin-${plugin.id}`;
  webview.setAttribute('allowpopups', 'false');
  webview.style.width = '640px';
  webview.style.height = '480px';

  webview.addEventListener('did-start-loading', () => {
    logAgentWebviewLifecycle(plugin.id, mountStartedAt, 'did-start-loading');
  });
  webview.addEventListener('dom-ready', () => {
    setAgentLoadPhase(plugin.id, 'dom-ready');
    logAgentWebviewLifecycle(plugin.id, mountStartedAt, 'dom-ready');
  });
  webview.addEventListener('did-finish-load', () => {
    setAgentLoadPhase(plugin.id, 'finished');
    logAgentWebviewLifecycle(plugin.id, mountStartedAt, 'did-finish-load');
  });
  webview.addEventListener('did-stop-loading', () => {
    logAgentWebviewLifecycle(plugin.id, mountStartedAt, 'did-stop-loading');
  });
  webview.addEventListener('did-fail-load', (event) => {
    logAgentWebviewLifecycle(plugin.id, mountStartedAt, 'did-fail-load', {
      errorCode: event.errorCode,
      errorDescription: event.errorDescription,
      isMainFrame: event.isMainFrame
    });
    if (event.isMainFrame) {
      rejectAgentReady(
        plugin.id,
        `Plugin ${plugin.id} agent webview failed to load (${event.errorDescription}).`
      );
    }
  });
  webview.addEventListener('render-process-gone', (event) => {
    logAgentWebviewLifecycle(plugin.id, mountStartedAt, 'render-process-gone', {
      reason: event.details.reason,
      exitCode: event.details.exitCode
    });
    rejectAgentReady(
      plugin.id,
      `Plugin ${plugin.id} agent webview render process gone (${event.details.reason}).`
    );
  });
  webview.addEventListener('unresponsive', () => {
    logAgentWebviewLifecycle(plugin.id, mountStartedAt, 'unresponsive');
  });
  webview.addEventListener('console-message', (event) => {
    const level =
      event.level >= 3 ? 'error' : event.level === 2 ? 'warn' : event.level === 1 ? 'info' : 'log';
    const logFn =
      event.level >= 3 ? console.error : event.level === 2 ? console.warn : console.debug;
    logFn(`[plugin agent ${plugin.id}] [${level}]`, event.message);
  });

  logAgentWebviewLifecycle(plugin.id, mountStartedAt, 'mounted', { src: agentUrl });
  ensureAgentContainer().appendChild(webview);
  agentWebviews.set(plugin.id, webview);
}

/**
 * Removes the hidden agent webview for one plugin.
 *
 * @param pluginId - Plugin manifest id.
 */
function unmountAgentWebview(pluginId: string): void {
  const webview = agentWebviews.get(pluginId);
  if (!webview) {
    return;
  }
  webview.remove();
  agentWebviews.delete(pluginId);
  agentLoadPhases.delete(pluginId);
}

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
 * Normalizes activation error messages for persistence.
 *
 * @param error - Thrown activation error.
 */
export function normalizePluginActivationError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('Failed to fetch dynamically imported module')) {
    return 'Failed to load plugin module.';
  }
  return message;
}

/**
 * Formats an activation error for terminal logging, including nested causes.
 *
 * @param error - Thrown activation error.
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
 * Disables a plugin and persists its activation failure for Settings.
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
 * Clears pending agent waiters and tracked webviews — test helper only.
 */
export function resetPluginLoaderForTests(): void {
  for (const [pluginId, waiter] of agentReadyWaiters.entries()) {
    clearTimeout(waiter.timeout);
    agentReadyWaiters.delete(pluginId);
  }
  agentWebviews.clear();
  agentLoadPhases.clear();
  pendingThemePromptIds.clear();
}

/**
 * Returns the last recorded agent load phase — test helper only.
 *
 * @param pluginId - Plugin manifest id.
 */
export function getAgentLoadPhaseForTests(pluginId: string): AgentLoadPhase | undefined {
  return getAgentLoadPhase(pluginId);
}

/**
 * Deactivates and unloads one plugin from the renderer host.
 *
 * @param pluginId - Plugin manifest id.
 */
export async function unloadPlugin(pluginId: string): Promise<void> {
  unmountAgentWebview(pluginId);
  clearPluginContributions(pluginId);
  clearPluginImportHandlers(pluginId);
  try {
    await window.api.deactivatePluginMain(pluginId);
  } catch {
    // Main entry may not have been active.
  }
  await applyPersistedPluginTheme();
}

/**
 * Registers themes declared via `contributes.themes[].import` JSON files.
 *
 * Manifest `id`, `title`, and `type` remain authoritative; the JSON supplies
 * colors and an optional (possibly inlined) stylesheet. Failures for a single
 * import are logged and skipped so other themes still register.
 *
 * @param plugin - Plugin metadata including manifest contributions.
 */
async function registerImportThemeContributions(plugin: PluginInfo): Promise<void> {
  const themes = plugin.manifest.contributes?.themes ?? [];
  for (const entry of themes) {
    if (!entry.import) {
      continue;
    }
    try {
      const resolved = await window.api.resolveThemeImport(plugin.id, entry.import);
      registerThemeContribution(plugin.id, {
        id: entry.id,
        title: entry.title,
        type: entry.type,
        colors: resolved.colors,
        stylesheet: resolved.stylesheet
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[plugin ${plugin.id}] failed to resolve theme import "${entry.import}": ${message}`
      );
    }
  }
}

/**
 * Activates one enabled plugin through its hidden agent webview.
 *
 * @param plugin - Plugin metadata from the main process.
 */
async function loadPlugin(plugin: PluginInfo): Promise<void> {
  if (!plugin.enabled || plugin.error) {
    return;
  }

  await unloadPlugin(plugin.id);

  try {
    await registerImportThemeContributions(plugin);

    if (!plugin.manifest.renderer) {
      if (plugin.manifest.main) {
        await window.api.activatePluginMain(plugin.id);
      }
      await applyPersistedPluginTheme();
      await clearActivationError(plugin.id);
      return;
    }

    let activationError: Error | undefined;
    for (let attempt = 1; attempt <= MAX_AGENT_ACTIVATION_ATTEMPTS; attempt += 1) {
      cancelAgentReadyWait(plugin.id);
      unmountAgentWebview(plugin.id);
      const readyPromise = waitForAgentReady(plugin.id);
      mountAgentWebview(plugin);
      try {
        await readyPromise;
        activationError = undefined;
        break;
      } catch (error) {
        cancelAgentReadyWait(plugin.id);
        activationError = error instanceof Error ? error : new Error(String(error));
        const phase = getAgentLoadPhase(plugin.id) ?? 'mounted';
        const hasAttemptsLeft = attempt < MAX_AGENT_ACTIVATION_ATTEMPTS;
        if (!hasAttemptsLeft) {
          break;
        }
        console.warn(
          `[plugin agent ${plugin.id}] activation attempt ${attempt}/${MAX_AGENT_ACTIVATION_ATTEMPTS} failed (phase: ${phase}), retrying...`
        );
      }
    }
    if (activationError) {
      throw activationError;
    }

    if (plugin.manifest.main) {
      await window.api.activatePluginMain(plugin.id);
    }

    await applyPersistedPluginTheme();
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
  for (const pluginId of [...agentWebviews.keys()]) {
    await unloadPlugin(pluginId);
  }
}

/**
 * Marks a plugin for a theme switch prompt after the next successful activation.
 *
 * @param pluginId - Plugin manifest id.
 */
export function markPluginForThemePrompt(pluginId: string): void {
  pendingThemePromptIds.add(pluginId);
}

/**
 * Returns whether a plugin was marked for a theme switch prompt.
 *
 * @param pluginId - Plugin manifest id.
 */
export function isPendingThemePrompt(pluginId: string): boolean {
  return pendingThemePromptIds.has(pluginId);
}

/**
 * Clears a pending theme prompt mark after the host finishes processing it.
 *
 * @param pluginId - Plugin manifest id.
 */
export function clearPendingThemePrompt(pluginId: string): void {
  pendingThemePromptIds.delete(pluginId);
}

/**
 * Returns pending theme prompt plugin ids and clears the queue.
 *
 * @returns Plugin ids marked since the last take.
 */
export function takePendingThemePromptPluginIds(): string[] {
  const ids = [...pendingThemePromptIds];
  pendingThemePromptIds.clear();
  return ids;
}

/**
 * Rolls back partial activation state when agent startup fails.
 *
 * @param pluginId - Plugin manifest id.
 */
export async function disposePartialRendererActivation(pluginId: string): Promise<void> {
  await unloadPlugin(pluginId);
}
