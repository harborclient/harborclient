import type { BrowserWindow } from 'electron';
import type { PluginManager } from '#/main/plugins/PluginManager';
import type { McpClientHeader, McpClientServerListItem } from '#/shared/types';

/** Prefix for plugin-owned MCP client server ids. */
export const PLUGIN_MCP_SERVER_ID_PREFIX = 'plugin:';

interface PluginMcpRegistration {
  pluginId: string;
  registrationId: string;
  name: string;
  url: string;
  headers: McpClientHeader[];
  enabled: boolean;
  icon?: string;
}

const registrations = new Map<string, PluginMcpRegistration>();

let pluginManager: PluginManager | null = null;
let mainWindowGetter: (() => BrowserWindow | null) | null = null;

/**
 * Supplies the plugin manager used to resolve plugin display names.
 *
 * @param manager - Active plugin manager instance.
 */
export function setPluginMcpRegistryManager(manager: PluginManager): void {
  pluginManager = manager;
}

/**
 * Supplies the main application window used to notify the renderer about list changes.
 *
 * @param getter - Returns the current main window or null when destroyed.
 */
export function setPluginMcpRegistryMainWindow(getter: () => BrowserWindow | null): void {
  mainWindowGetter = getter;
}

/**
 * Builds the stable id for one plugin MCP registration.
 *
 * @param pluginId - Plugin manifest id.
 * @param registrationId - Agent-scoped registration id.
 */
export function buildPluginMcpServerId(pluginId: string, registrationId: string): string {
  return `${PLUGIN_MCP_SERVER_ID_PREFIX}${pluginId}:${registrationId}`;
}

/**
 * Returns true when an MCP client server id is owned by a plugin registration.
 *
 * @param serverId - MCP client server id.
 */
export function isPluginMcpServerId(serverId: string): boolean {
  return serverId.startsWith(PLUGIN_MCP_SERVER_ID_PREFIX);
}

/**
 * Normalizes one MCP header row from plugin registration input.
 *
 * @param header - Raw header row.
 */
function normalizeMcpHeader(header: McpClientHeader): McpClientHeader {
  return {
    key: String(header.key ?? '').trim(),
    value: String(header.value ?? '')
  };
}

/**
 * Validates an optional MCP server icon data URI.
 *
 * @param icon - Optional icon from plugin registration input.
 */
function normalizeMcpServerIcon(icon: unknown): string | undefined {
  if (icon == null || icon === '') {
    return undefined;
  }
  const value = String(icon).trim();
  if (!/^data:image\/(?:png|jpeg|jpg|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(value)) {
    throw new Error(
      'MCP server icon must be a base64 data URI (data:image/png;base64,... or data:image/svg+xml;base64,...).'
    );
  }
  return value;
}

/**
 * Normalizes plugin MCP server registration input from the UI broker.
 *
 * @param input - Raw registration payload.
 */
function normalizeRegistrationInput(input: {
  name: string;
  serverURL: string;
  enabled?: boolean;
  headers?: McpClientHeader[];
  icon?: string;
}): Omit<PluginMcpRegistration, 'pluginId' | 'registrationId'> {
  const name = String(input.name ?? '').trim();
  const url = String(input.serverURL ?? '')
    .trim()
    .replace(/\/+$/, '');
  if (!name) {
    throw new Error('MCP server name is required.');
  }
  if (!url) {
    throw new Error('MCP server URL is required.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('MCP server URL must be an absolute HTTP or HTTPS URL.');
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('MCP server URL must use http or https.');
  }

  return {
    name,
    url,
    enabled: input.enabled !== false,
    headers: Array.isArray(input.headers)
      ? input.headers.map(normalizeMcpHeader).filter((row) => row.key.length > 0)
      : [],
    icon: normalizeMcpServerIcon(input.icon)
  };
}

/**
 * Notifies the renderer that the effective MCP client server list changed.
 */
function emitMcpClientServersChanged(): void {
  const window = mainWindowGetter?.();
  if (window && !window.isDestroyed()) {
    window.webContents.send('mcp:clientServersChanged');
  }
}

/**
 * Resolves the display name for one plugin id.
 *
 * @param pluginId - Plugin manifest id.
 */
function resolvePluginName(pluginId: string): string {
  if (!pluginManager) {
    return pluginId;
  }
  try {
    return pluginManager.get(pluginId)?.manifest.name ?? pluginId;
  } catch {
    return pluginId;
  }
}

/**
 * Registers or replaces one plugin-owned MCP client server.
 *
 * @param pluginId - Plugin manifest id.
 * @param registrationId - Agent-scoped registration id.
 * @param input - Serializable registration payload.
 */
export function registerPluginMcpServer(
  pluginId: string,
  registrationId: string,
  input: {
    name: string;
    serverURL: string;
    enabled?: boolean;
    headers?: McpClientHeader[];
    icon?: string;
  }
): void {
  const normalized = normalizeRegistrationInput(input);
  const key = `${pluginId}::${registrationId}`;
  registrations.set(key, {
    pluginId,
    registrationId,
    ...normalized
  });
  emitMcpClientServersChanged();
}

/**
 * Removes one plugin-owned MCP client server registration.
 *
 * @param pluginId - Plugin manifest id.
 * @param registrationId - Agent-scoped registration id.
 */
export function unregisterPluginMcpServer(pluginId: string, registrationId: string): void {
  const key = `${pluginId}::${registrationId}`;
  if (!registrations.delete(key)) {
    return;
  }
  emitMcpClientServersChanged();
}

/**
 * Removes every MCP client server registration owned by one plugin.
 *
 * @param pluginId - Plugin manifest id.
 */
export function clearPluginMcpServers(pluginId: string): void {
  let changed = false;
  for (const key of [...registrations.keys()]) {
    if (key.startsWith(`${pluginId}::`)) {
      registrations.delete(key);
      changed = true;
    }
  }
  if (changed) {
    emitMcpClientServersChanged();
  }
}

/**
 * Lists plugin-owned MCP client servers as settings/runtime list items.
 */
export function listPluginMcpClientServers(): McpClientServerListItem[] {
  return [...registrations.values()].map((entry) => ({
    id: buildPluginMcpServerId(entry.pluginId, entry.registrationId),
    name: entry.name,
    url: entry.url,
    headers: entry.headers,
    enabled: entry.enabled,
    source: 'plugin',
    pluginId: entry.pluginId,
    pluginName: resolvePluginName(entry.pluginId),
    icon: entry.icon,
    readonly: true
  }));
}

/**
 * Clears every plugin MCP registration — test helper only.
 */
export function resetPluginMcpRegistryForTests(): void {
  registrations.clear();
  pluginManager = null;
  mainWindowGetter = null;
}
