import { useEffect } from 'react';
import { startMcpServerBridge } from '#/renderer/src/store/ai/mcpServerBridge';

/**
 * Mounts the MCP server tool bridge so external MCP clients can execute Harbor tools.
 */
export function McpHost(): null {
  /**
   * Subscribes to MCP server tool invocations for the lifetime of the renderer.
   */
  useEffect(() => {
    return startMcpServerBridge();
  }, []);

  return null;
}
