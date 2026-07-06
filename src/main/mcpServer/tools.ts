import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { AI_TOOL_DEFINITIONS } from '#/shared/ai/tools';
import type { AiToolName } from '#/shared/ai/tools';
import { getAiToolInputShape } from '#/main/mcpServer/aiToolInputSchemas';
import { getMcpToolBridge } from '#/main/mcpServer/hostBridge';
import type { McpServerSettings } from '#/shared/types';

/**
 * Registers Harbor AI tools on an MCP server, filtered by the exposed-tool allowlist.
 *
 * @param server - MCP server instance to register tools on.
 * @param exposedTools - Harbor tool names the user opted into exposing.
 */
export function registerHarborMcpTools(server: McpServer, exposedTools: AiToolName[]): void {
  const allowed = new Set(exposedTools);
  const bridge = getMcpToolBridge();

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
  return settings.enabled && settings.exposedTools.length > 0 && settings.token.trim().length > 0;
}
