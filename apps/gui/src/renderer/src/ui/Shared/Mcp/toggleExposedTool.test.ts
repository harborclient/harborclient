import { describe, expect, it } from 'vitest';
import { AI_TOOL_NAMES } from '@harborclient/core/ai/tools';
import { toggleExposedTool } from './toggleExposedTool';

describe('toggleExposedTool', () => {
  it('adds and removes tools while preserving registry order', () => {
    const withoutCollections = AI_TOOL_NAMES.filter((name) => name !== 'list_collections');

    expect(toggleExposedTool(withoutCollections, 'list_collections', true)).toEqual([
      ...AI_TOOL_NAMES
    ]);
    expect(toggleExposedTool(AI_TOOL_NAMES, 'list_collections', false)).toEqual(withoutCollections);
  });
});
