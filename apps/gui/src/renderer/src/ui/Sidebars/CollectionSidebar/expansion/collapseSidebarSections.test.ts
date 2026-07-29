import { describe, expect, it } from 'vitest';
import { builtInSectionsToCollapse, collapsePluginSectionsInMap } from './collapseSidebarSections';

describe('builtInSectionsToCollapse', () => {
  it('returns only built-in keys present in the visible key list', () => {
    expect(builtInSectionsToCollapse(['collections', 'history', 'plugin.foo'])).toEqual([
      'collections',
      'history'
    ]);
  });

  it('returns an empty list when no built-in keys are visible', () => {
    expect(builtInSectionsToCollapse(['plugin.foo', 'plugin.bar'])).toEqual([]);
  });
});

describe('collapsePluginSectionsInMap', () => {
  it('collapses only plugin sections present in keys', () => {
    const current = { 'plugin.a': true, 'plugin.b': true, 'plugin.c': false };
    const next = collapsePluginSectionsInMap(
      current,
      ['plugin.a', 'collections'],
      ['plugin.a', 'plugin.b', 'plugin.c']
    );

    expect(next).toEqual({ 'plugin.a': false, 'plugin.b': true, 'plugin.c': false });
  });

  it('returns the same map reference when nothing changes', () => {
    const current = { 'plugin.a': false };
    expect(collapsePluginSectionsInMap(current, ['plugin.a'], ['plugin.a'])).toBe(current);
  });

  it('collapses plugin sections that were previously unset (default expanded)', () => {
    const current: Record<string, boolean> = {};
    expect(collapsePluginSectionsInMap(current, ['plugin.a'], ['plugin.a'])).toEqual({
      'plugin.a': false
    });
  });
});
