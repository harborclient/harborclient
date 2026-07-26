import { describe, expect, it } from 'vitest';
import { collectSidebarItemMarkers, filterItemsByMarker } from './sidebarMarkerFilter';

describe('collectSidebarItemMarkers', () => {
  it('returns an empty array when no items have markers', () => {
    expect(
      collectSidebarItemMarkers([{ marker: null }, { marker: undefined }, { marker: '' }])
    ).toEqual([]);
  });

  it('deduplicates markers case-insensitively and keeps the first-seen form', () => {
    expect(
      collectSidebarItemMarkers([
        { marker: '#FF0000' },
        { marker: '#ff0000' },
        { marker: '  #00FF00  ' }
      ])
    ).toEqual(['#00FF00', '#FF0000']);
  });

  it('sorts markers locale-ascending', () => {
    expect(
      collectSidebarItemMarkers([
        { marker: '#bbbbbb' },
        { marker: '#aaaaaa' },
        { marker: '#cccccc' }
      ])
    ).toEqual(['#aaaaaa', '#bbbbbb', '#cccccc']);
  });
});

describe('filterItemsByMarker', () => {
  const items = [
    { id: 1, marker: '#FF0000' },
    { id: 2, marker: null },
    { id: 3, marker: '#00ff00' },
    { id: 4, marker: '#FF0000' }
  ];

  it('returns a copy of all items when the filter is null', () => {
    const result = filterItemsByMarker(items, null);
    expect(result).toEqual(items);
    expect(result).not.toBe(items);
  });

  it('keeps only items whose marker matches case-insensitively', () => {
    expect(filterItemsByMarker(items, '#ff0000')).toEqual([
      { id: 1, marker: '#FF0000' },
      { id: 4, marker: '#FF0000' }
    ]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterItemsByMarker(items, '#0000ff')).toEqual([]);
  });
});
