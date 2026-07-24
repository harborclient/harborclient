import { describe, expect, it } from 'vitest';
import { mergeVisibleTabOrder } from './mergeVisibleTabOrder';

describe('mergeVisibleTabOrder', () => {
  it('returns the new visible order when no tabs are hidden', () => {
    expect(mergeVisibleTabOrder(['a', 'b', 'c'], new Set(), ['c', 'a', 'b'])).toEqual([
      'c',
      'a',
      'b'
    ]);
  });

  it('keeps hidden tabs pinned while reordering visible tabs', () => {
    const hidden = new Set(['hidden-1', 'hidden-2']);
    expect(
      mergeVisibleTabOrder(['a', 'hidden-1', 'b', 'hidden-2', 'c'], hidden, ['c', 'a', 'b'])
    ).toEqual(['c', 'hidden-1', 'a', 'hidden-2', 'b']);
  });

  it('moves a visible tab across hidden tabs during drag reorder', () => {
    const hidden = new Set(['page-tab']);
    expect(
      mergeVisibleTabOrder(['req-1', 'page-tab', 'req-2', 'req-3'], hidden, [
        'req-3',
        'req-1',
        'req-2'
      ])
    ).toEqual(['req-3', 'page-tab', 'req-1', 'req-2']);
  });
});
