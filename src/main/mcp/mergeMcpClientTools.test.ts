import { describe, expect, it, vi } from 'vitest';
import { mergeMcpClientTools } from '#/main/mcp/mergeMcpClientTools';
import { AI_TOOL_DEFINITIONS } from '#/shared/ai/tools';

vi.mock('#/main/mcp/mcpClientManager', () => ({
  getMcpClientTools: () => [
    {
      type: 'function',
      function: {
        name: 'mcp__remote__search',
        description: 'Remote search tool',
        parameters: { type: 'object', properties: {} }
      }
    }
  ]
}));

describe('mergeMcpClientTools', () => {
  it('appends MCP client tools in default chat mode', () => {
    const merged = mergeMcpClientTools({
      systemPrompt: 'prompt',
      tools: AI_TOOL_DEFINITIONS,
      messages: []
    });

    expect(merged).toHaveLength(AI_TOOL_DEFINITIONS.length + 1);
    const lastTool = merged.at(-1);
    expect(lastTool?.type).toBe('function');
    if (lastTool?.type === 'function') {
      expect(lastTool.function.name).toBe('mcp__remote__search');
    }
  });

  it('does not append MCP client tools for forced mini-agent steps', () => {
    const merged = mergeMcpClientTools({
      systemPrompt: 'prompt',
      tools: AI_TOOL_DEFINITIONS.slice(0, 1),
      messages: [],
      toolChoice: { type: 'function', function: { name: 'set_chat_title' } }
    });

    expect(merged).toHaveLength(1);
    const firstTool = merged[0];
    expect(firstTool?.type).toBe('function');
    if (firstTool?.type === 'function') {
      const expected = AI_TOOL_DEFINITIONS[0];
      expect(expected?.type).toBe('function');
      if (expected?.type === 'function') {
        expect(firstTool.function.name).toBe(expected.function.name);
      }
    }
  });
});
