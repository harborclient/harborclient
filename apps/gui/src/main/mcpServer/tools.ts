import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  AI_TOOL_DEFINITIONS,
  type AiToolName,
  getAiToolInputShape
} from '@harborclient/core/ai/tools';
import { getMcpToolBridge } from './hostBridge';
import type { McpServerSettings } from '@harborclient/core/types';

/**
 * Registers the allowlisted Harbor AI tools on an MCP server.
 *
 * Tools omitted from `exposedTools` are not advertised via `tools/list` and
 * cannot be invoked through this server instance.
 *
 * @param server - MCP server instance to register tools on.
 * @param exposedTools - Allowlist of Harbor AI tool names to expose.
 */
export function registerHarborMcpTools(
  server: McpServer,
  exposedTools: readonly AiToolName[]
): void {
  const bridge = getMcpToolBridge();
  const allowed = new Set(exposedTools);

  for (const definition of AI_TOOL_DEFINITIONS) {
    if (definition.type !== 'function') {
      continue;
    }

    const name = definition.function.name as AiToolName;
    if (!allowed.has(name)) {
      continue;
    }

    server.registerTool(
      name,
      {
        description: definition.function.description,
        inputSchema: getAiToolInputShape(name)
      },
      (async (args: Record<string, unknown> | undefined) => {
        try {
          const result = await bridge.invokeTool(name, args ?? {});
          return {
            content: [
              {
                type: 'text',
                text: result
              }
            ]
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Tool execution failed.';
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: message })
              }
            ]
          };
        }
      }) as never
    );
  }
}

/**
 * Returns whether MCP server settings require a running HTTP listener.
 *
 * @param settings - Persisted MCP server settings.
 */
export function shouldRunMcpServer(settings: McpServerSettings): boolean {
  return settings.enabled && settings.token.trim().length > 0;
}
