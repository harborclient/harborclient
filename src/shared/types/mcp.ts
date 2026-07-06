import type { AiToolName } from '#/shared/ai/tools';

/**
 * Persisted MCP server settings for exposing Harbor tools to external clients.
 */
export interface McpServerSettings {
  /**
   * When true and at least one tool is exposed, the local MCP HTTP server listens.
   */
  enabled: boolean;

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
   */
  exposedTools: AiToolName[];
}

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
