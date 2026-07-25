import { describe, expect, it } from 'vitest';
import { AI_SYSTEM_PROMPT, AI_TOOL_DEFINITIONS, AI_TOOL_NAMES } from './tools';

describe('AI_TOOL_DEFINITIONS', () => {
  it('defines a unique tool name for each entry', () => {
    const names = AI_TOOL_DEFINITIONS.map((tool) =>
      tool.type === 'function' ? tool.function.name : tool.custom.name
    );
    expect(new Set(names).size).toBe(names.length);
  });

  it('includes every name from AI_TOOL_NAMES', () => {
    const names = AI_TOOL_DEFINITIONS.map((tool) =>
      tool.type === 'function' ? tool.function.name : tool.custom.name
    );
    expect(names.sort()).toEqual([...AI_TOOL_NAMES].sort());
  });
});

describe('AI_SYSTEM_PROMPT', () => {
  it('is non-empty and references the tools', () => {
    expect(AI_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    for (const name of AI_TOOL_NAMES) {
      expect(AI_SYSTEM_PROMPT).toContain(name);
    }
  });

  it('requires syntactically substitutable script range edits', () => {
    expect(AI_SYSTEM_PROMPT).toContain(
      'source.slice(0, startOffset) + code + source.slice(endOffset)'
    );
    expect(AI_SYSTEM_PROMPT).toContain('Never add an hc.test wrapper via replace_range');
    expect(AI_SYSTEM_PROMPT).toContain('do not claim the change was applied');
  });
});
