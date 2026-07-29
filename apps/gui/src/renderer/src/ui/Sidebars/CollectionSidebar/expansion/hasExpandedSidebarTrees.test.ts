import { describe, expect, it } from 'vitest';
import { hasExpandedSidebarTrees, hasExpandedSidebarTreesForMode } from './hasExpandedSidebarTrees';

describe('hasExpandedSidebarTrees', () => {
  it('returns true when at least one collection tree is expanded', () => {
    expect(hasExpandedSidebarTrees(new Set([1]), new Set(), new Set())).toBe(true);
  });

  it('returns true when at least one folder tree is expanded', () => {
    expect(hasExpandedSidebarTrees(new Set(), new Set([9]), new Set())).toBe(true);
  });

  it('returns true when at least one environment tree is expanded', () => {
    expect(hasExpandedSidebarTrees(new Set(), new Set(), new Set([3]))).toBe(true);
  });

  it('returns false when no collection, folder, or environment trees are expanded', () => {
    expect(hasExpandedSidebarTrees(new Set(), new Set(), new Set())).toBe(false);
  });
});

describe('hasExpandedSidebarTreesForMode', () => {
  it('checks collection and folder trees in collections mode', () => {
    expect(
      hasExpandedSidebarTreesForMode('collections', new Set([1]), new Set(), new Set([9]))
    ).toBe(true);
    expect(
      hasExpandedSidebarTreesForMode('collections', new Set(), new Set([2]), new Set([9]))
    ).toBe(true);
    expect(hasExpandedSidebarTreesForMode('collections', new Set(), new Set(), new Set([9]))).toBe(
      false
    );
  });

  it('checks only environment trees in environments mode', () => {
    expect(
      hasExpandedSidebarTreesForMode('environments', new Set([1]), new Set([2]), new Set())
    ).toBe(false);
    expect(
      hasExpandedSidebarTreesForMode('environments', new Set([1]), new Set([2]), new Set([3]))
    ).toBe(true);
  });

  it('returns false for modes without expandable trees', () => {
    expect(
      hasExpandedSidebarTreesForMode('workspaces', new Set([1]), new Set([2]), new Set([3]))
    ).toBe(false);
    expect(
      hasExpandedSidebarTreesForMode('workflows', new Set([1]), new Set([2]), new Set([3]))
    ).toBe(false);
    expect(hasExpandedSidebarTreesForMode('trash', new Set([1]), new Set([2]), new Set([3]))).toBe(
      false
    );
  });
});
