import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { decodeMcpToolName, encodeMcpToolName } from '#/shared/mcpToolNames';
import { logVerbose } from '#/main/logger';
import { createVerboseMcpClientFetch } from '#/main/mcp/mcpClientVerboseFetch';
import { listMcpClientServers } from '#/main/settings/mcpSettings';
import type { McpClientServer, McpClientServerStatus, McpClientToolInfo } from '#/shared/types';

interface ConnectedMcpClient {
  server: McpClientServer;
  client?: Client;
  transport?: StreamableHTTPClientTransport | SSEClientTransport;
  remoteTools: Tool[];
  error?: string;
}

const connectedClients = new Map<string, ConnectedMcpClient>();
let cachedTools: ChatCompletionTool[] = [];

/**
 * Builds HTTP headers for an MCP client connection.
 *
 * @param server - Configured MCP client server.
 */
function buildRequestHeaders(server: McpClientServer): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const row of server.headers) {
    if (row.key.trim()) {
      headers[row.key.trim()] = row.value;
    }
  }
  return headers;
}

/**
 * Converts MCP tool input schema into an OpenAI function tool definition.
 *
 * @param serverId - Configured MCP client server id.
 * @param tool - Tool metadata from tools/list.
 */
function toOpenAiTool(serverId: string, tool: Tool): ChatCompletionTool {
  const prefixedName = encodeMcpToolName(serverId, tool.name);
  return {
    type: 'function',
    function: {
      name: prefixedName,
      description: tool.description ?? `MCP tool ${tool.name}`,
      parameters: (tool.inputSchema as Record<string, unknown> | undefined) ?? {
        type: 'object',
        properties: {},
        additionalProperties: true
      }
    }
  };
}

/**
 * Flattens MCP callTool content into a JSON string for the chat agent loop.
 *
 * @param content - MCP tool result content array.
 */
function flattenMcpToolContent(content: unknown): string {
  if (!Array.isArray(content)) {
    return JSON.stringify(content ?? null);
  }

  const parts = content.map((item) => {
    if (!item || typeof item !== 'object') {
      return String(item);
    }
    const record = item as { type?: string; text?: string; uri?: string };
    if (record.type === 'text' && typeof record.text === 'string') {
      return record.text;
    }
    if (record.type === 'resource' && typeof record.uri === 'string') {
      return record.uri;
    }
    return JSON.stringify(record);
  });

  return parts.join('\n');
}

/**
 * Updates cached OpenAI tools for one connected MCP client entry.
 *
 * @param entry - Connected MCP client entry.
 */
function updateEntryToolCache(entry: ConnectedMcpClient): void {
  entry.remoteTools = entry.remoteTools ?? [];
  rebuildCachedTools();
}

/**
 * Rebuilds the OpenAI-format tool cache from connected MCP clients.
 */
function rebuildCachedTools(): void {
  cachedTools = [];
  for (const entry of connectedClients.values()) {
    if (entry.error || !entry.remoteTools.length) {
      continue;
    }
    for (const tool of entry.remoteTools) {
      cachedTools.push(toOpenAiTool(entry.server.id, tool));
    }
  }
}

/**
 * Connects to one MCP client server and caches its tools.
 *
 * @param server - Enabled MCP client server configuration.
 */
async function connectMcpClientServer(server: McpClientServer): Promise<ConnectedMcpClient> {
  const headers = buildRequestHeaders(server);
  const url = new URL(server.url);

  logVerbose('mcp:client:connecting', {
    serverId: server.id,
    name: server.name,
    url: server.url
  });

  const verboseFetch = createVerboseMcpClientFetch({
    serverId: server.id,
    name: server.name
  });

  const entry: ConnectedMcpClient = {
    server,
    remoteTools: []
  };

  const client = new Client(
    {
      name: 'harborclient',
      version: '1.0.0'
    },
    {
      listChanged: {
        tools: {
          onChanged: (error, tools) => {
            if (error || !tools) {
              return;
            }
            entry.remoteTools = tools;
            updateEntryToolCache(entry);
          }
        }
      }
    }
  );

  let transport: StreamableHTTPClientTransport | SSEClientTransport;
  let transportName: 'streamable-http' | 'sse';
  try {
    transport = new StreamableHTTPClientTransport(url, {
      requestInit: { headers },
      fetch: verboseFetch
    });
    await client.connect(transport);
    transportName = 'streamable-http';
  } catch {
    transport = new SSEClientTransport(url, {
      requestInit: { headers },
      fetch: verboseFetch
    });
    await client.connect(transport);
    transportName = 'sse';
  }

  const { tools } = await client.listTools();
  entry.client = client;
  entry.transport = transport;
  entry.remoteTools = tools;

  logVerbose('mcp:client:connected', {
    serverId: server.id,
    transport: transportName,
    toolCount: tools.length
  });

  return entry;
}

/**
 * Disconnects and removes one MCP client connection.
 *
 * @param serverId - Client server id to disconnect.
 */
async function disconnectMcpClientServer(serverId: string): Promise<void> {
  const entry = connectedClients.get(serverId);
  if (!entry) {
    return;
  }

  logVerbose('mcp:client:disconnected', { serverId });
  connectedClients.delete(serverId);
  if (entry.client) {
    try {
      await entry.client.close();
    } catch {
      // Ignore close errors during teardown.
    }
  }
}

/**
 * Reconnects all enabled MCP client servers from persisted settings.
 */
export async function refreshMcpClientConnections(): Promise<void> {
  const servers = listMcpClientServers();
  const enabledIds = new Set(servers.filter((server) => server.enabled).map((server) => server.id));

  for (const serverId of [...connectedClients.keys()]) {
    if (!enabledIds.has(serverId)) {
      await disconnectMcpClientServer(serverId);
    }
  }

  for (const server of servers) {
    if (!server.enabled) {
      connectedClients.delete(server.id);
      continue;
    }

    await disconnectMcpClientServer(server.id);

    try {
      const connected = await connectMcpClientServer(server);
      connectedClients.set(server.id, connected);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed.';
      logVerbose('mcp:client:connect-failed', {
        serverId: server.id,
        url: server.url,
        error: errorMessage
      });
      connectedClients.set(server.id, {
        server,
        remoteTools: [],
        error: errorMessage
      });
    }
  }

  const enabledCount = servers.filter((server) => server.enabled).length;
  const connectedCount = [...connectedClients.values()].filter((entry) => !entry.error).length;
  logVerbose('mcp:client:refresh', { enabledCount, connectedCount });

  rebuildCachedTools();
}

/**
 * Returns cached MCP client tools in OpenAI chat completion format.
 */
export function getMcpClientTools(): ChatCompletionTool[] {
  return cachedTools;
}

/**
 * Lists cached MCP client tool metadata for settings and diagnostics.
 */
export function listMcpClientToolInfos(): McpClientToolInfo[] {
  const tools: McpClientToolInfo[] = [];
  for (const entry of connectedClients.values()) {
    for (const tool of entry.remoteTools) {
      tools.push({
        prefixedName: encodeMcpToolName(entry.server.id, tool.name),
        serverId: entry.server.id,
        toolName: tool.name,
        description: tool.description
      });
    }
  }
  return tools;
}

/**
 * Returns connection status for each configured MCP client server.
 */
export function listMcpClientServerStatuses(): McpClientServerStatus[] {
  const servers = listMcpClientServers();
  return servers.map((server) => {
    const entry = connectedClients.get(server.id);
    if (!server.enabled) {
      return {
        id: server.id,
        connected: false,
        toolCount: 0,
        error: 'Disabled'
      };
    }

    if (!entry) {
      return {
        id: server.id,
        connected: false,
        toolCount: 0,
        error: 'Not connected'
      };
    }

    if (entry.error) {
      return {
        id: server.id,
        connected: false,
        toolCount: 0,
        error: entry.error
      };
    }

    return {
      id: server.id,
      connected: true,
      toolCount: entry.remoteTools.length
    };
  });
}

/**
 * Invokes a prefixed MCP client tool on the matching remote server.
 *
 * @param prefixedName - Tool name with mcp__ prefix from the model.
 * @param args - Parsed tool arguments object.
 */
export async function callMcpClientTool(prefixedName: string, args: unknown): Promise<string> {
  const decoded = decodeMcpToolName(prefixedName);
  if (!decoded) {
    return JSON.stringify({ error: `Unknown MCP tool: ${prefixedName}` });
  }

  const entry = connectedClients.get(decoded.serverId);
  if (!entry?.client || entry.error) {
    return JSON.stringify({ error: `MCP server ${decoded.serverId} is not connected.` });
  }

  try {
    const result = await entry.client.callTool({
      name: decoded.toolName,
      arguments: (args ?? {}) as Record<string, unknown>
    });

    if (result.isError) {
      logVerbose('mcp:client:tool', {
        prefixedName,
        serverId: decoded.serverId,
        toolName: decoded.toolName,
        isError: true
      });
      return JSON.stringify({
        error: flattenMcpToolContent(result.content)
      });
    }

    logVerbose('mcp:client:tool', {
      prefixedName,
      serverId: decoded.serverId,
      toolName: decoded.toolName,
      isError: false
    });
    return flattenMcpToolContent(result.content);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MCP tool execution failed.';
    logVerbose('mcp:client:tool', {
      prefixedName,
      serverId: decoded.serverId,
      toolName: decoded.toolName,
      isError: true,
      error: message
    });
    return JSON.stringify({ error: message });
  }
}

/**
 * Closes all MCP client connections during app shutdown.
 */
export async function disposeMcpClientConnections(): Promise<void> {
  for (const serverId of [...connectedClients.keys()]) {
    await disconnectMcpClientServer(serverId);
  }
  cachedTools = [];
}
