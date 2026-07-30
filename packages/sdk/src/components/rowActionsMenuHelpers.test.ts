import { describe, expect, it, vi } from 'vitest';
import type { MenuItem } from './RowActionsMenu/index.js';
import { findEdgeEnabledIndex } from './rowActionsMenuHelpers.js';

/**
 * Builds a minimal menu item for helper tests.
 *
 * @param label - Visible item label.
 * @param disabled - Whether the item is disabled.
 * @returns Menu item fixture.
 */
function item(label: string, disabled = false): MenuItem {
  return { label, disabled, onSelect: vi.fn() };
}

describe('findEdgeEnabledIndex', () => {
  it('returns the first enabled index from the start', () => {
    const items = [item('a', true), item('b'), item('c')];
    expect(findEdgeEnabledIndex(items, false)).toBe(1);
  });

  it('returns the last enabled index from the end', () => {
    const items = [item('a'), item('b'), item('c', true)];
    expect(findEdgeEnabledIndex(items, true)).toBe(1);
  });

  it('returns null when every item is disabled', () => {
    const items = [item('empty', true)];
    expect(findEdgeEnabledIndex(items, false)).toBeNull();
    expect(findEdgeEnabledIndex(items, true)).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(findEdgeEnabledIndex([], false)).toBeNull();
    expect(findEdgeEnabledIndex([], true)).toBeNull();
  });
});
