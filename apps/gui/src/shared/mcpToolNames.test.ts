import { describe, expect, it } from 'vitest';
import { decodeMcpToolName, encodeMcpToolName, isMcpPrefixedToolName } from './mcpToolNames';

describe('mcpToolNames', () => {
  it('encodes and decodes prefixed MCP tool names', () => {
    const prefixed = encodeMcpToolName('server-1', 'read_file');
    expect(prefixed).toBe('mcp__server-1__read_file');
    expect(decodeMcpToolName(prefixed)).toEqual({
      serverId: 'server-1',
      toolName: 'read_file'
    });
  });

  it('returns null for invalid prefixed names', () => {
    expect(decodeMcpToolName('list_collections')).toBeNull();
    expect(decodeMcpToolName('mcp__only-server')).toBeNull();
  });

  it('detects MCP-prefixed tool names', () => {
    expect(isMcpPrefixedToolName('mcp__abc__tool')).toBe(true);
    expect(isMcpPrefixedToolName('get_active_request')).toBe(false);
  });
});
