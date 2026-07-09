import { describe, expect, it, vi } from 'vitest';
import {
  buildTabCloseMenuGroups,
  chatIdsWithMessages,
  tabIdsToCloseOthers,
  tabIdsToCloseToTheRight
} from './tabContextMenuHelpers';

describe('tabIdsToCloseOthers', () => {
  it('returns every id except the target', () => {
    expect(tabIdsToCloseOthers(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('returns all ids when the target is not present', () => {
    expect(tabIdsToCloseOthers(['a', 'b'], 'missing')).toEqual(['a', 'b']);
  });
});

describe('tabIdsToCloseToTheRight', () => {
  it('returns ids after the target index', () => {
    expect(tabIdsToCloseToTheRight(['a', 'b', 'c', 'd'], 'b')).toEqual(['c', 'd']);
  });

  it('returns an empty array for the last tab', () => {
    expect(tabIdsToCloseToTheRight(['a', 'b'], 'b')).toEqual([]);
  });

  it('returns an empty array when the target is missing', () => {
    expect(tabIdsToCloseToTheRight(['a', 'b'], 'missing')).toEqual([]);
  });
});

describe('chatIdsWithMessages', () => {
  it('keeps chats that have messages and excludes empty chats', () => {
    const messagesByChat = {
      1: [{ id: 1 }],
      2: [],
      3: [{ id: 2 }, { id: 3 }]
    };

    expect(chatIdsWithMessages([1, 2, 3], messagesByChat)).toEqual([1, 3]);
  });

  it('treats missing message lists as empty chats', () => {
    expect(chatIdsWithMessages([4, 5], {})).toEqual([]);
  });
});

describe('buildTabCloseMenuGroups', () => {
  it('includes conditional close actions based on tab order', () => {
    const onClose = vi.fn();
    const onCloseMany = vi.fn();
    const onCloseSaved = vi.fn();
    const groups = buildTabCloseMenuGroups(['a', 'b', 'c'], 'b', {
      onClose,
      onCloseMany,
      onCloseSaved
    });

    const labels = groups.flat().map((item) => item.label);
    expect(labels).toEqual([
      'Close',
      'Close others',
      'Close to the right',
      'Close saved',
      'Close all'
    ]);

    groups.flat()[0].onSelect();
    groups.flat()[1].onSelect();
    groups.flat()[2].onSelect();
    groups.flat()[4].onSelect();

    expect(onClose).toHaveBeenCalledWith('b');
    expect(onCloseMany).toHaveBeenCalledWith(['a', 'c']);
    expect(onCloseMany).toHaveBeenCalledWith(['c']);
    expect(onCloseMany).toHaveBeenCalledWith(['a', 'b', 'c']);
  });

  it('omits close others and close to the right for a single tab', () => {
    const groups = buildTabCloseMenuGroups(['only'], 'only', {
      onClose: vi.fn(),
      onCloseMany: vi.fn(),
      onCloseSaved: vi.fn()
    });

    expect(groups.flat().map((item) => item.label)).toEqual(['Close', 'Close saved', 'Close all']);
  });
});
