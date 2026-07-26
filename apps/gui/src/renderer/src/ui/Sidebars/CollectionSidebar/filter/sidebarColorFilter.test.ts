import { describe, expect, it } from 'vitest';
import { collectSidebarItemColors, filterItemsByColor } from './sidebarColorFilter';

describe('collectSidebarItemColors', () => {
  it('returns an empty array when no items have colors', () => {
    expect(
      collectSidebarItemColors([{ color: null }, { color: undefined }, { color: '' }])
    ).toEqual([]);
  });

  it('deduplicates colors case-insensitively and keeps the first-seen form', () => {
    expect(
      collectSidebarItemColors([
        { color: '#FF0000' },
        { color: '#ff0000' },
        { color: '  #00FF00  ' }
      ])
    ).toEqual(['#00FF00', '#FF0000']);
  });

  it('sorts colors locale-ascending', () => {
    expect(
      collectSidebarItemColors([{ color: '#bbbbbb' }, { color: '#aaaaaa' }, { color: '#cccccc' }])
    ).toEqual(['#aaaaaa', '#bbbbbb', '#cccccc']);
  });
});

describe('filterItemsByColor', () => {
  const items = [
    { id: 1, color: '#FF0000' },
    { id: 2, color: null },
    { id: 3, color: '#00ff00' },
    { id: 4, color: '#FF0000' }
  ];

  it('returns a copy of all items when the filter is null', () => {
    const result = filterItemsByColor(items, null);
    expect(result).toEqual(items);
    expect(result).not.toBe(items);
  });

  it('keeps only items whose color matches case-insensitively', () => {
    expect(filterItemsByColor(items, '#ff0000')).toEqual([
      { id: 1, color: '#FF0000' },
      { id: 4, color: '#FF0000' }
    ]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterItemsByColor(items, '#0000ff')).toEqual([]);
  });
});
