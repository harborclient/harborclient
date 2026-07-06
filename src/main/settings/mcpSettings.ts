import { randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '#/main/secrets/secretStorage';
import { AI_TOOL_NAMES, type AiToolName } from '#/shared/ai/tools';
import { parseJson } from '#/shared/parseJson';
import type { McpClientHeader, McpClientServer, McpServerSettings } from '#/shared/types';

const MCP_SERVER_KEY = 'mcpServerSettings';
const MCP_CLIENT_SERVERS_KEY = 'mcpClientServers';

const DEFAULT_MCP_SERVER_PORT = 7333;

/**
 * Default MCP server settings when none are stored.
 */
export const DEFAULT_MCP_SERVER_SETTINGS: McpServerSettings = {
  enabled: false,
  host: '127.0.0.1',
  port: DEFAULT_MCP_SERVER_PORT,
  token: '',
  exposedTools: []
};

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
 * Returns true when a tool name is a known Harbor AI tool.
 *
 * @param name - Tool name candidate.
 */
function isAiToolName(name: string): name is AiToolName {
  return (AI_TOOL_NAMES as readonly string[]).includes(name);
}

/**
 * Normalizes MCP server settings from storage or user input.
 *
 * @param input - Partial or raw MCP server settings.
 */
function normalizeMcpServerSettings(input: Partial<McpServerSettings>): McpServerSettings {
  const exposedTools = Array.isArray(input.exposedTools)
    ? input.exposedTools.filter(isAiToolName)
    : [];

  const port =
    typeof input.port === 'number' && Number.isInteger(input.port) && input.port > 0
      ? input.port
      : DEFAULT_MCP_SERVER_PORT;

  return {
    enabled: Boolean(input.enabled),
    host: String(input.host ?? DEFAULT_MCP_SERVER_SETTINGS.host).trim() || '127.0.0.1',
    port,
    token: String(input.token ?? '').trim(),
    exposedTools
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
      const settings = parseJson<Partial<McpServerSettings>>(
        decrypted,
        DEFAULT_MCP_SERVER_SETTINGS
      );
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
  const stored = parseJson<McpClientServer[]>(
    getLocalDatabase().getSetting(MCP_CLIENT_SERVERS_KEY),
    []
  );
  return stored.map(normalizeMcpClientServer);
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
  const servers = listMcpClientServers();
  const nextServers = servers.filter((server) => server.id !== id);

  if (nextServers.length === servers.length) {
    throw new Error(`Unknown MCP client server: ${id}`);
  }

  persistMcpClientServers(nextServers);
  return nextServers;
}
