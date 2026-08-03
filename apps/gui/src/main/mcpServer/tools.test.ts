import { describe, expect, it, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerHarborMcpTools, shouldRunMcpServer } from './tools';
import { DEFAULT_MCP_SERVER_SETTINGS } from '#/main/settings/mcpSettings';

describe('shouldRunMcpServer', () => {
  it('requires enable, running, and a bearer token', () => {
    expect(shouldRunMcpServer(DEFAULT_MCP_SERVER_SETTINGS)).toBe(false);
    expect(
      shouldRunMcpServer({
        ...DEFAULT_MCP_SERVER_SETTINGS,
        enabled: true,
        running: true,
        token: ''
      })
    ).toBe(false);
    expect(
      shouldRunMcpServer({
        ...DEFAULT_MCP_SERVER_SETTINGS,
        enabled: true,
        running: false,
        token: 'secret'
      })
    ).toBe(false);
    expect(
      shouldRunMcpServer({
        ...DEFAULT_MCP_SERVER_SETTINGS,
        enabled: true,
        running: true,
        token: 'secret'
      })
    ).toBe(true);
  });
});

describe('registerHarborMcpTools', () => {
  it('registers only allowlisted tools', () => {
    const registerTool = vi.fn();
    const server = { registerTool } as unknown as McpServer;

    registerHarborMcpTools(server, ['list_collections', 'send_active_request']);

    const registeredNames = registerTool.mock.calls.map((call) => call[0] as string);
    expect(registeredNames).toEqual(['list_collections', 'send_active_request']);
  });

  it('registers nothing when the allowlist is empty', () => {
    const registerTool = vi.fn();
    const server = { registerTool } as unknown as McpServer;

    registerHarborMcpTools(server, []);

    expect(registerTool).not.toHaveBeenCalled();
  });
});
