import type { McpServerSettings, McpServerStatus } from '#/shared/types';

/**
 * Builds a paste-ready MCP server entry for Cursor / Claude Desktop config files.
 *
 * Returns only the `HarborClient` block (indented for insertion under `mcpServers`),
 * not a full JSON document.
 *
 * @param settings - Saved MCP server settings.
 * @param status - Current MCP server runtime status.
 * @returns Indented JSON fragment for the HarborClient server entry.
 */
export function buildMcpConfigSnippet(
  settings: McpServerSettings,
  status: McpServerStatus
): string {
  const host = settings.host.trim() || '127.0.0.1';
  const port = status.port ?? settings.port;
  const url = `http://${host}:${port}/mcp`;
  const entryJson = JSON.stringify(
    {
      HarborClient: {
        url,
        headers: {
          Authorization: `Bearer ${settings.token}`
        }
      }
    },
    null,
    2
  );

  return entryJson
    .split('\n')
    .slice(1, -1)
    .map((line) => `  ${line}`)
    .join('\n');
}
