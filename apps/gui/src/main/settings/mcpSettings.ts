import { randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '#/main/secrets/secretStorage';
import { AI_TOOL_NAMES, type AiToolName } from '@harborclient/core/ai/tools';
import { isPlainObject, parseJson } from '@harborclient/core/parseJson';
import type {
  McpClientHeader,
  McpClientServer,
  McpClientServerListItem,
  McpServerSettings
} from '@harborclient/core/types';
import { isPluginMcpServerId, listPluginMcpClientServers } from '#/main/plugins/pluginMcpRegistry';

const MCP_SERVER_KEY = 'mcpServerSettings';
const MCP_CLIENT_SERVERS_KEY = 'mcpClientServers';

const DEFAULT_MCP_SERVER_PORT = 7333;

/**
 * Default MCP server settings when none are stored.
 *
 * New installs expose every Harbor AI agent tool; users can narrow the
 * allowlist from the MCP panel Tools view.
 */
export const DEFAULT_MCP_SERVER_SETTINGS: McpServerSettings = {
  enabled: false,
  running: false,
  name: 'HarborClient',
  logoUrl: 'https://harborclient.com/images/logo.png',
  host: '127.0.0.1',
  port: DEFAULT_MCP_SERVER_PORT,
  token: '',
  exposedTools: [...AI_TOOL_NAMES],
  keepLogs: true
};

/**
 * Normalizes an MCP tool allowlist to valid {@link AiToolName} entries.
 *
 * Missing or non-array values default to the full registry. Arrays keep only
 * known tool names, in registry order (empty allowlists are preserved).
 *
 * @param input - Raw `exposedTools` value from storage or user input.
 * @returns Allowlist in {@link AI_TOOL_NAMES} order.
 */
export function normalizeExposedTools(input: unknown): AiToolName[] {
  if (!Array.isArray(input)) {
    return [...AI_TOOL_NAMES];
  }

  const allowed = new Set<string>(AI_TOOL_NAMES);
  const selected = new Set(
    input.filter((name): name is AiToolName => typeof name === 'string' && allowed.has(name))
  );

  return AI_TOOL_NAMES.filter((name) => selected.has(name));
}

/**
 * Generates a new MCP server bearer token.
 */
export function generateMcpServerToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Returns true when the parsed value is an encrypted secret envelope.
 *
 * @param value - Parsed registry value.
 */
function isEncryptedSecret(value: unknown): value is EncryptedSecret {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as EncryptedSecret;
  return (
    record.v === 1 &&
    (record.method === 'safeStorage' || record.method === 'local') &&
    typeof record.ciphertext === 'string'
  );
}

/**
 * Normalizes MCP server settings from storage or user input.
 *
 * @param input - Partial or raw MCP server settings.
 */
function normalizeMcpServerSettings(input: Partial<McpServerSettings>): McpServerSettings {
  const port =
    typeof input.port === 'number' && Number.isInteger(input.port) && input.port > 0
      ? input.port
      : DEFAULT_MCP_SERVER_PORT;

  const enabled = Boolean(input.enabled);
  // Pre-`running` installs treated `enabled` as listen intent; migrate once.
  const running = input.running !== undefined ? Boolean(input.running) : enabled;

  return {
    enabled,
    running,
    name:
      String(input.name ?? DEFAULT_MCP_SERVER_SETTINGS.name).trim() ||
      DEFAULT_MCP_SERVER_SETTINGS.name,
    logoUrl:
      String(input.logoUrl ?? DEFAULT_MCP_SERVER_SETTINGS.logoUrl).trim() ||
      DEFAULT_MCP_SERVER_SETTINGS.logoUrl,
    host: String(input.host ?? DEFAULT_MCP_SERVER_SETTINGS.host).trim() || '127.0.0.1',
    port,
    token: String(input.token ?? '').trim(),
    exposedTools: normalizeExposedTools(input.exposedTools),
    keepLogs: input.keepLogs ?? true
  };
}

/**
 * Reads persisted MCP server settings.
 */
export function getMcpServerSettings(): McpServerSettings {
  const raw = getLocalDatabase().getSetting(MCP_SERVER_KEY);
  if (!raw) {
    return DEFAULT_MCP_SERVER_SETTINGS;
  }

  const parsed: unknown = parseJson(raw, null);
  if (!parsed) {
    return DEFAULT_MCP_SERVER_SETTINGS;
  }

  if (isEncryptedSecret(parsed)) {
    try {
      const decrypted = decryptSecret(parsed);
      const settingsParsed = parseJson(decrypted, null);
      const settings = isPlainObject(settingsParsed)
        ? (settingsParsed as Partial<McpServerSettings>)
        : DEFAULT_MCP_SERVER_SETTINGS;
      return normalizeMcpServerSettings(settings);
    } catch {
      return DEFAULT_MCP_SERVER_SETTINGS;
    }
  }

  if (typeof parsed === 'object') {
    return normalizeMcpServerSettings(parsed as Partial<McpServerSettings>);
  }

  throw new Error('Stored MCP server settings are invalid or corrupted.');
}

/**
 * Persists MCP server settings.
 *
 * @param input - Settings to store.
 */
export function setMcpServerSettings(input: McpServerSettings): McpServerSettings {
  const normalized = normalizeMcpServerSettings(input);
  const encrypted = encryptSecret(JSON.stringify(normalized));
  getLocalDatabase().setSetting(MCP_SERVER_KEY, JSON.stringify(encrypted));
  return normalized;
}

/**
 * Generates and persists a new MCP server bearer token.
 */
export function regenerateMcpServerToken(): McpServerSettings {
  const current = getMcpServerSettings();
  return setMcpServerSettings({
    ...current,
    token: generateMcpServerToken()
  });
}

/**
 * Ensures MCP server settings include a bearer token when enabling the server.
 *
 * @param input - Settings about to be persisted.
 */
export function ensureMcpServerToken(input: McpServerSettings): McpServerSettings {
  if (input.enabled && !input.token.trim()) {
    return {
      ...input,
      token: generateMcpServerToken()
    };
  }
  return input;
}

/**
 * Validates a bearer token against persisted settings using constant-time comparison.
 *
 * @param provided - Token from an incoming HTTP Authorization header.
 */
export function isValidMcpServerToken(provided: string): boolean {
  const expected = getMcpServerSettings().token;
  if (!expected || !provided) {
    return false;
  }

  const expectedBytes = new Uint8Array(Buffer.from(expected));
  const providedBytes = new Uint8Array(Buffer.from(provided));
  if (expectedBytes.length !== providedBytes.length) {
    return false;
  }

  return timingSafeEqual(expectedBytes, providedBytes);
}

/**
 * Normalizes one MCP client header row.
 *
 * @param header - Raw header row.
 */
function normalizeMcpClientHeader(header: McpClientHeader): McpClientHeader {
  return {
    key: String(header.key ?? '').trim(),
    value: String(header.value ?? '')
  };
}

/**
 * Normalizes one MCP client server record.
 *
 * @param input - Raw client server from storage or user input.
 */
function normalizeMcpClientServer(input: McpClientServer): McpClientServer {
  return {
    id: input.id.trim(),
    name: input.name.trim(),
    url: input.url.trim().replace(/\/+$/, ''),
    headers: Array.isArray(input.headers)
      ? input.headers.map(normalizeMcpClientHeader).filter((row) => row.key.length > 0)
      : [],
    enabled: Boolean(input.enabled)
  };
}

/**
 * Persists the MCP client server list.
 *
 * @param servers - Client servers to store.
 */
function persistMcpClientServers(servers: McpClientServer[]): void {
  getLocalDatabase().setSetting(MCP_CLIENT_SERVERS_KEY, JSON.stringify(servers));
}

/**
 * Lists configured MCP client servers.
 */
export function listMcpClientServers(): McpClientServer[] {
  const parsed = parseJson(getLocalDatabase().getSetting(MCP_CLIENT_SERVERS_KEY), []);
  const stored = Array.isArray(parsed) ? parsed : [];
  return stored.map((entry) => normalizeMcpClientServer(entry as McpClientServer));
}

/**
 * Lists user-configured and plugin-registered MCP client servers for settings and runtime.
 */
export function listEffectiveMcpClientServers(): McpClientServerListItem[] {
  const userServers = listMcpClientServers().map(
    (server): McpClientServerListItem => ({
      ...server,
      source: 'user',
      readonly: false
    })
  );
  return [...userServers, ...listPluginMcpClientServers()];
}

/**
 * Creates or updates an MCP client server.
 *
 * @param input - Client server to persist; blank id inserts a new record.
 */
export function saveMcpClientServer(input: McpClientServer): McpClientServer[] {
  const normalized = normalizeMcpClientServer({
    ...input,
    id: input.id.trim() || randomUUID()
  });
  if (isPluginMcpServerId(normalized.id)) {
    throw new Error('Plugin-provided MCP client servers cannot be modified from settings.');
  }
  const servers = listMcpClientServers();
  const index = servers.findIndex((server) => server.id === normalized.id);

  if (index >= 0) {
    servers[index] = normalized;
  } else {
    servers.push(normalized);
  }

  persistMcpClientServers(servers);
  return servers;
}

/**
 * Deletes an MCP client server by id.
 *
 * @param id - Client server id to remove.
 */
export function deleteMcpClientServer(id: string): McpClientServer[] {
  if (isPluginMcpServerId(id)) {
    throw new Error('Plugin-provided MCP client servers cannot be deleted from settings.');
  }
  const servers = listMcpClientServers();
  const nextServers = servers.filter((server) => server.id !== id);

  if (nextServers.length === servers.length) {
    throw new Error(`Unknown MCP client server: ${id}`);
  }

  persistMcpClientServers(nextServers);
  return nextServers;
}
