import { describe, expect, it } from 'vitest';
import { hasExpandedSidebarTrees } from './hasExpandedSidebarTrees';

describe('hasExpandedSidebarTrees', () => {
  it('returns true when at least one collection tree is expanded', () => {
    expect(hasExpandedSidebarTrees(new Set([1]), new Set())).toBe(true);
  });

  it('returns true when at least one folder tree is expanded', () => {
    expect(hasExpandedSidebarTrees(new Set(), new Set([9]))).toBe(true);
  });

  it('returns false when no collection or folder trees are expanded', () => {
    expect(hasExpandedSidebarTrees(new Set(), new Set())).toBe(false);
  });
});
