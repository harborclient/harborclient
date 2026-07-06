import { describe, expect, it } from 'vitest';
import { shouldRunMcpServer } from '#/main/mcpServer/tools';
import { DEFAULT_MCP_SERVER_SETTINGS } from '#/main/settings/mcpSettings';

describe('shouldRunMcpServer', () => {
  it('requires enable flag, token, and at least one exposed tool', () => {
    expect(shouldRunMcpServer(DEFAULT_MCP_SERVER_SETTINGS)).toBe(false);
    expect(
      shouldRunMcpServer({
        ...DEFAULT_MCP_SERVER_SETTINGS,
        enabled: true,
        token: 'secret',
        exposedTools: []
      })
    ).toBe(false);
    expect(
      shouldRunMcpServer({
        ...DEFAULT_MCP_SERVER_SETTINGS,
        enabled: true,
        token: 'secret',
        exposedTools: ['list_collections']
      })
    ).toBe(true);
  });
});
