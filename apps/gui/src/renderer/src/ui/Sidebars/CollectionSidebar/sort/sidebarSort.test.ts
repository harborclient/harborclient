import { describe, expect, it } from 'vitest';
import { sidebarSortOptions, sortSidebarItems, toSortTimestamp } from './sidebarSort';

interface Item {
  name: string;
  createdAt: number;
  color?: string | null;
}

const accessors = {
  name: (item: Item) => item.name,
  createdAt: (item: Item) => item.createdAt,
  color: (item: Item) => item.color
};

describe('sidebarSortOptions', () => {
  it('omits Color when hasColor is false', () => {
    expect(sidebarSortOptions(false).map((option) => option.id)).toEqual([
      'default',
      'name-asc',
      'name-desc',
      'created-asc',
      'created-desc'
    ]);
  });

  it('includes Color when hasColor is true', () => {
    expect(sidebarSortOptions(true).map((option) => option.id)).toContain('color');
  });

  it('uses a custom date label for trash-style deleted timestamps', () => {
    const options = sidebarSortOptions(false, 'Date deleted');
    expect(options.find((option) => option.id === 'created-asc')?.label).toBe(
      'Date deleted ascending'
    );
    expect(options.find((option) => option.id === 'created-desc')?.label).toBe(
      'Date deleted descending'
    );
  });
});

describe('sortSidebarItems', () => {
  const items: Item[] = [
    { name: 'Charlie', createdAt: 300, color: '#ff0000' },
    { name: 'alpha', createdAt: 100, color: null },
    { name: 'Bravo', createdAt: 200, color: '#00ff00' }
  ];

  it('leaves default order unchanged', () => {
    expect(sortSidebarItems(items, 'default', accessors).map((item) => item.name)).toEqual([
      'Charlie',
      'alpha',
      'Bravo'
    ]);
  });

  it('sorts A-Z ascending case-insensitively', () => {
    expect(sortSidebarItems(items, 'name-asc', accessors).map((item) => item.name)).toEqual([
      'alpha',
      'Bravo',
      'Charlie'
    ]);
  });

  it('sorts A-Z descending case-insensitively', () => {
    expect(sortSidebarItems(items, 'name-desc', accessors).map((item) => item.name)).toEqual([
      'Charlie',
      'Bravo',
      'alpha'
    ]);
  });

  it('sorts by created date ascending and descending', () => {
    expect(sortSidebarItems(items, 'created-asc', accessors).map((item) => item.createdAt)).toEqual([
      100, 200, 300
    ]);
    expect(sortSidebarItems(items, 'created-desc', accessors).map((item) => item.createdAt)).toEqual(
      [300, 200, 100]
    );
  });

  it('sorts by color with uncolored items last', () => {
    expect(sortSidebarItems(items, 'color', accessors).map((item) => item.name)).toEqual([
      'Bravo',
      'Charlie',
      'alpha'
    ]);
  });
});

describe('toSortTimestamp', () => {
  it('parses ISO strings and numbers', () => {
    expect(toSortTimestamp(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(toSortTimestamp('2024-01-01T00:00:00.000Z')).toBe(Date.parse('2024-01-01T00:00:00.000Z'));
    expect(toSortTimestamp(null)).toBe(0);
    expect(toSortTimestamp('not-a-date')).toBe(0);
  });
});
