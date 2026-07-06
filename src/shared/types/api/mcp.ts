import type {
  McpClientServer,
  McpClientServerStatus,
  McpClientToolInfo,
  McpServerSettings,
  McpServerStatus
} from '#/shared/types/mcp';

/**
 * IPC methods for MCP server and client configuration.
 */
export interface ApiMcp {
  /**
   * Returns persisted MCP server settings.
   */
  getMcpServerSettings: () => Promise<McpServerSettings>;

  /**
   * Persists MCP server settings and applies the HTTP listener lifecycle.
   *
   * @param settings - Server enable flag, bind address, port, token, and exposed tools.
   */
  setMcpServerSettings: (settings: McpServerSettings) => Promise<McpServerSettings>;

  /**
   * Returns whether the local MCP HTTP server is running.
   */
  getMcpServerStatus: () => Promise<McpServerStatus>;

  /**
   * Generates a new MCP server bearer token and persists it.
   */
  regenerateMcpServerToken: () => Promise<McpServerSettings>;

  /**
   * Lists configured remote MCP client servers.
   */
  listMcpClientServers: () => Promise<McpClientServer[]>;

  /**
   * Creates or updates a remote MCP client server and reconnects when enabled.
   *
   * @param server - Client server record; blank id inserts a new row.
   */
  saveMcpClientServer: (server: McpClientServer) => Promise<McpClientServer[]>;

  /**
   * Deletes a remote MCP client server by id.
   *
   * @param id - Client server id to remove.
   */
  deleteMcpClientServer: (id: string) => Promise<McpClientServer[]>;

  /**
   * Returns connection status for each configured MCP client server.
   */
  listMcpClientServerStatuses: () => Promise<McpClientServerStatus[]>;

  /**
   * Lists cached MCP client tools available to the chat agent.
   */
  listMcpClientTools: () => Promise<McpClientToolInfo[]>;

  /**
   * Invokes a prefixed MCP client tool on the matching remote server.
   *
   * @param prefixedName - Tool name with mcp__ prefix from the model.
   * @param args - Parsed tool arguments object.
   */
  mcpCallTool: (prefixedName: string, args: unknown) => Promise<string>;

  /**
   * Subscribes to MCP server tool invocations routed from external MCP clients.
   */
  onMcpServerToolInvoke: (
    callback: (message: { requestId: number; name: string; args: unknown }) => void
  ) => () => void;

  /**
   * Completes an MCP server tool invocation with a result or error.
   */
  completeMcpServerTool: (message: {
    requestId: number;
    ok: boolean;
    result?: string;
    error?: string;
  }) => void;
}
