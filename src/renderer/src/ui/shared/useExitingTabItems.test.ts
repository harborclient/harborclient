import { describe, expect, it } from 'vitest';
import { detectRemovedTabItems, resolveInsertBeforeId } from './useExitingTabItems';

interface TestTab {
  id: string;
  label: string;
}

const getId = (tab: TestTab): string => tab.id;

describe('resolveInsertBeforeId', () => {
  const tabs: TestTab[] = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
    { id: 'd', label: 'D' }
  ];

  it('returns the immediate right neighbor when it remains open', () => {
    expect(resolveInsertBeforeId(tabs, 1, new Set(['a', 'c', 'd']), getId)).toBe('c');
  });

  it('skips removed neighbors and anchors to the next open tab', () => {
    expect(resolveInsertBeforeId(tabs, 1, new Set(['a', 'd']), getId)).toBe('d');
  });

  it('returns null when the removed tab was last in the row', () => {
    expect(resolveInsertBeforeId(tabs, 3, new Set(['a', 'b', 'c']), getId)).toBeNull();
  });
});

describe('detectRemovedTabItems', () => {
  const previous: TestTab[] = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
    { id: 'd', label: 'D' }
  ];

  it('detects a single removed tab with the correct anchor', () => {
    const current = previous.filter((tab) => tab.id !== 'b');

    expect(detectRemovedTabItems(previous, current, getId)).toEqual([
      {
        item: { id: 'b', label: 'B' },
        insertBeforeId: 'c'
      }
    ]);
  });

  it('detects bulk removals and preserves independent anchors', () => {
    const current = previous.filter((tab) => tab.id === 'a' || tab.id === 'd');

    expect(detectRemovedTabItems(previous, current, getId)).toEqual([
      {
        item: { id: 'b', label: 'B' },
        insertBeforeId: 'd'
      },
      {
        item: { id: 'c', label: 'C' },
        insertBeforeId: 'd'
      }
    ]);
  });

  it('anchors a removed last tab to null', () => {
    const current = previous.filter((tab) => tab.id !== 'd');

    expect(detectRemovedTabItems(previous, current, getId)).toEqual([
      {
        item: { id: 'd', label: 'D' },
        insertBeforeId: null
      }
    ]);
  });

  it('returns an empty array when nothing was removed', () => {
    expect(detectRemovedTabItems(previous, previous, getId)).toEqual([]);
  });
});
