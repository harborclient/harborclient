import type { AiToolName } from '../ai/tools/index';

/**
 * Persisted MCP server settings for exposing Harbor tools to external clients.
 */
export interface McpServerSettings {
  /**
   * When true, MCP server UI is available (footer MCP button). Does not start
   * or stop the HTTP listener — use {@link McpServerSettings.running} for that.
   */
  enabled: boolean;

  /**
   * When true and {@link McpServerSettings.enabled} is true, the local MCP HTTP
   * server should listen. Toggled only from the footer Start/Stop controls.
   */
  running: boolean;

  /**
   * Display name advertised to MCP clients as `serverInfo.title`.
   */
  name: string;

  /**
   * Logo image URL advertised to MCP clients via `serverInfo.icons`.
   */
  logoUrl: string;

  /**
   * Network interface to bind (for example 127.0.0.1 or 0.0.0.0).
   */
  host: string;

  /**
   * TCP port for the MCP HTTP endpoint.
   */
  port: number;

  /**
   * Bearer token required on incoming MCP HTTP requests.
   */
  token: string;

  /**
   * Harbor AI tool names exposed through the MCP server.
   *
   * User-selectable allowlist persisted in settings. Only listed tools are
   * registered for MCP `tools/list` / `tools/call`. Defaults to the full
   * {@link AiToolName} set; order matches the Harbor AI tool registry.
   */
  exposedTools: AiToolName[];

  /**
   * When true, sanitized MCP server request/response traffic is appended to the
   * local database for the footer log viewer. Defaults to true.
   */
  keepLogs: boolean;
}

/**
 * Maximum MCP server log rows retained in LocalDatabase.
 */
export const MCP_SERVER_LOG_CAP = 1000;

/**
 * Direction of an MCP server log line relative to Harbor.
 */
export type McpServerLogDirection = 'in' | 'out';

/**
 * Category of MCP server traffic captured in the log buffer.
 */
export type McpServerLogKind = 'http' | 'session' | 'tool' | 'lifecycle';

/**
 * One sanitized MCP server log entry persisted in LocalDatabase.
 *
 * Never includes Authorization headers, bearer tokens, JSON-RPC params/results,
 * or tool argument/result bodies.
 */
export interface McpServerLogEntry {
  /**
   * Autoincrement row id.
   */
  id: number;

  /**
   * Unix epoch milliseconds when the event occurred.
   */
  timestamp: number;

  /**
   * Whether the event is inbound (client → Harbor) or outbound (Harbor → client).
   */
  direction: McpServerLogDirection;

  /**
   * High-level event category.
   */
  kind: McpServerLogKind;

  /**
   * HTTP method when {@link kind} is `http` (for example `POST`).
   */
  method?: string;

  /**
   * HTTP path when {@link kind} is `http` (for example `/mcp`).
   */
  path?: string;

  /**
   * JSON-RPC method name when known (for example `initialize`, `tools/call`).
   */
  rpcMethod?: string;

  /**
   * Harbor AI tool name for tool invoke/complete events.
   */
  toolName?: string;

  /**
   * HTTP status code when applicable.
   */
  statusCode?: number;

  /**
   * Whether a tool invoke completed successfully.
   */
  ok?: boolean;

  /**
   * Duration in milliseconds when measurable.
   */
  durationMs?: number;

  /**
   * MCP session id when known (UUID; not sensitive).
   */
  sessionId?: string;

  /**
   * Sanitized error message (never echoes tokens or request bodies).
   */
  error?: string;
}

/**
 * Fields required to append a sanitized MCP server log row (id assigned by SQLite).
 */
export type McpServerLogInput = Omit<McpServerLogEntry, 'id'>;

/**
 * One remote MCP server Harbor connects to as a client.
 */
export interface McpClientServer {
  /**
   * Stable record id.
   */
  id: string;

  /**
   * Display name in settings.
   */
  name: string;

  /**
   * MCP server URL (Streamable HTTP or legacy SSE endpoint).
   */
  url: string;

  /**
   * Optional HTTP headers sent with MCP client requests.
   */
  headers: McpClientHeader[];

  /**
   * When false, the client manager skips connecting to this server.
   */
  enabled: boolean;
}

/**
 * Source of an MCP client server row shown in settings and used by the client manager.
 */
export type McpClientServerSource = 'user' | 'plugin';

/**
 * MCP client server row returned to the renderer, including ownership metadata.
 */
export interface McpClientServerListItem extends McpClientServer {
  /**
   * Whether the row comes from user settings or a plugin registration.
   */
  source: McpClientServerSource;

  /**
   * Plugin manifest id when {@link source} is `plugin`.
   */
  pluginId?: string;

  /**
   * Plugin display name when {@link source} is `plugin`.
   */
  pluginName?: string;

  /**
   * Optional settings icon provided by the plugin as a data URI.
   */
  icon?: string;

  /**
   * When true, the row cannot be edited or deleted from settings.
   */
  readonly: boolean;
}

/**
 * HTTP header row for MCP client server connections.
 */
export interface McpClientHeader {
  /**
   * Header name.
   */
  key: string;

  /**
   * Header value.
   */
  value: string;
}

/**
 * Runtime status of the local MCP server.
 */
export interface McpServerStatus {
  /**
   * Whether the HTTP listener is accepting connections.
   */
  running: boolean;

  /**
   * Whether the MCP server feature is enabled in settings (footer button visible).
   */
  enabled: boolean;

  /**
   * Bound host when running.
   */
  host?: string;

  /**
   * Assigned listen port when running.
   */
  port?: number;
}

/**
 * Connection status for one configured MCP client server.
 */
export interface McpClientServerStatus {
  /**
   * Configured server id.
   */
  id: string;

  /**
   * Whether the client is connected and tools were listed successfully.
   */
  connected: boolean;

  /**
   * Human-readable connection error when not connected.
   */
  error?: string;

  /**
   * Number of tools discovered from this server.
   */
  toolCount: number;
}

/**
 * Summary of one MCP tool discovered from a client server.
 */
export interface McpClientToolInfo {
  /**
   * Prefixed tool name sent to the LLM (mcp__serverId__toolName).
   */
  prefixedName: string;

  /**
   * Source MCP server id.
   */
  serverId: string;

  /**
   * Original tool name on the remote server.
   */
  toolName: string;

  /**
   * Tool description from the remote server.
   */
  description?: string;
}
