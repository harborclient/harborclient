import { describe, expect, it } from 'vitest';
import { buildMcpConfigSnippet } from './buildMcpConfigSnippet';

describe('buildMcpConfigSnippet', () => {
  it('returns an indented HarborClient entry for pasting under mcpServers', () => {
    const snippet = buildMcpConfigSnippet(
      {
        enabled: true,
        host: '127.0.0.1',
        port: 8765,
        token: 'secret-token',
        exposedTools: ['list_collections']
      },
      { running: true, host: '127.0.0.1', port: 8765 }
    );

    expect(snippet).toBe(
      `    "HarborClient": {
      "url": "http://127.0.0.1:8765/mcp",
      "headers": {
        "Authorization": "Bearer secret-token"
      }
    }`
    );

    const parsed = JSON.parse(`{\n  "mcpServers": {\n${snippet}\n  }\n}`) as {
      mcpServers: Record<string, { url?: string; headers?: { Authorization?: string } }>;
    };

    expect(parsed.mcpServers.HarborClient).toMatchObject({
      url: 'http://127.0.0.1:8765/mcp',
      headers: { Authorization: 'Bearer secret-token' }
    });
  });
});
