import { stopMcpServer } from '#/main/mcpServer/mcpServer';
import { disposeMcpToolBridge, getMcpToolBridge } from '#/main/mcpServer/hostBridge';
import { disposeMcpClientConnections } from '#/main/mcp/mcpClientManager';

export { getMcpToolBridge };

/**
 * Disposes MCP server and client runtimes during app shutdown.
 */
export async function disposeMcpHost(): Promise<void> {
  disposeMcpToolBridge();
  await stopMcpServer();
  await disposeMcpClientConnections();
}
