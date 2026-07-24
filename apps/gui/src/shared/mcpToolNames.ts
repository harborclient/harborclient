/**
 * Prefix for MCP client tools merged into the chat agent tool list.
 */
export const MCP_TOOL_PREFIX = 'mcp__';

/**
 * Builds a prefixed MCP tool name for LLM routing.
 *
 * @param serverId - Configured MCP client server id.
 * @param toolName - Original tool name from the remote server.
 */
export function encodeMcpToolName(serverId: string, toolName: string): string {
  return `${MCP_TOOL_PREFIX}${serverId}__${toolName}`;
}

/**
 * Parses a prefixed MCP tool name into server id and original tool name.
 *
 * @param prefixed - Tool name from an assistant tool call.
 */
export function decodeMcpToolName(prefixed: string): { serverId: string; toolName: string } | null {
  if (!prefixed.startsWith(MCP_TOOL_PREFIX)) {
    return null;
  }

  const rest = prefixed.slice(MCP_TOOL_PREFIX.length);
  const separatorIndex = rest.indexOf('__');
  if (separatorIndex <= 0) {
    return null;
  }

  return {
    serverId: rest.slice(0, separatorIndex),
    toolName: rest.slice(separatorIndex + 2)
  };
}

/**
 * Returns whether a tool name belongs to a configured MCP client server.
 *
 * @param name - Tool name from the model.
 */
export function isMcpPrefixedToolName(name: string): boolean {
  return name.startsWith(MCP_TOOL_PREFIX);
}
