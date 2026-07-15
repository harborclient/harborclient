import { describe, expect, it } from 'vitest';
import { parseMcpClientServerImportSnippet } from './parseMcpClientServerImport';

const EXA_FRAGMENT = `"exa": {
  "url": "https://mcp.exa.ai/mcp",
  "headers": {
    "x-api-key": "4fbd5841-94f6-43f1-87c3-f3b09cf855a8"
  }
}`;

describe('parseMcpClientServerImportSnippet', () => {
  it('parses an indented mcpServers fragment', () => {
    const result = parseMcpClientServerImportSnippet(EXA_FRAGMENT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toEqual({
        name: 'exa',
        url: 'https://mcp.exa.ai/mcp',
        headers: [{ key: 'x-api-key', value: '4fbd5841-94f6-43f1-87c3-f3b09cf855a8' }]
      });
    }
  });

  it('parses a full mcpServers document', () => {
    const result = parseMcpClientServerImportSnippet(
      JSON.stringify(
        {
          mcpServers: {
            exa: {
              url: 'https://mcp.exa.ai/mcp',
              headers: {
                'x-api-key': 'abc'
              }
            }
          }
        },
        null,
        2
      )
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.name).toBe('exa');
      expect(result.result.url).toBe('https://mcp.exa.ai/mcp');
      expect(result.result.headers).toEqual([{ key: 'x-api-key', value: 'abc' }]);
    }
  });

  it('rejects multiple server entries', () => {
    const result = parseMcpClientServerImportSnippet(
      JSON.stringify({
        mcpServers: {
          exa: { url: 'https://mcp.exa.ai/mcp' },
          github: { url: 'https://example.com/mcp' }
        }
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Paste one MCP server entry at a time.');
    }
  });

  it('rejects invalid JSON', () => {
    const result = parseMcpClientServerImportSnippet('"exa": {');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Import text must be valid JSON.');
    }
  });

  it('rejects entries without a url', () => {
    const result = parseMcpClientServerImportSnippet(
      JSON.stringify({
        mcpServers: {
          exa: {
            headers: {
              'x-api-key': 'abc'
            }
          }
        }
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('No MCP server entry found in the pasted JSON.');
    }
  });
});
