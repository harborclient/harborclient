import { describe, expect, it } from 'vitest';
import {
  applySidebarSelectionClick,
  orderSelectedIds,
  rangeSelectIds,
  toggleSidebarSelection
} from './sidebarSelectionUtils';

describe('toggleSidebarSelection', () => {
  it('adds an id when it is not selected', () => {
    expect(toggleSidebarSelection(new Set([1]), 2)).toEqual(new Set([1, 2]));
  });

  it('removes an id when it is already selected', () => {
    expect(toggleSidebarSelection(new Set([1, 2]), 2)).toEqual(new Set([1]));
  });
});

describe('rangeSelectIds', () => {
  it('returns the inclusive slice between two anchors', () => {
    expect(rangeSelectIds([10, 20, 30, 40], 10, 30)).toEqual([10, 20, 30]);
    expect(rangeSelectIds([10, 20, 30, 40], 30, 10)).toEqual([10, 20, 30]);
  });

  it('falls back to the target id when an anchor is missing', () => {
    expect(rangeSelectIds([10, 20], 99, 20)).toEqual([20]);
  });
});

describe('applySidebarSelectionClick', () => {
  const visibleOrder = [1, 2, 3, 4];

  it('clears selection and opens on a plain click', () => {
    const result = applySidebarSelectionClick(new Set([2, 3]), 2, visibleOrder, 4, {
      shiftKey: false,
      ctrlOrMetaKey: false
    });
    expect(result).toEqual({
      selectedIds: new Set(),
      anchorId: 4,
      shouldOpen: true
    });
  });

  it('toggles membership on ctrl/meta click without opening', () => {
    const result = applySidebarSelectionClick(new Set([2]), 2, visibleOrder, 3, {
      shiftKey: false,
      ctrlOrMetaKey: true
    });
    expect(result).toEqual({
      selectedIds: new Set([2, 3]),
      anchorId: 3,
      shouldOpen: false
    });
  });

  it('selects only the clicked row when shift-clicking without an anchor', () => {
    const result = applySidebarSelectionClick(new Set(), null, visibleOrder, 3, {
      shiftKey: true,
      ctrlOrMetaKey: false
    });
    expect(result).toEqual({
      selectedIds: new Set([3]),
      anchorId: 3,
      shouldOpen: false
    });
  });

  it('replaces selection with a range on shift-click when an anchor exists', () => {
    const result = applySidebarSelectionClick(new Set([1]), 1, visibleOrder, 4, {
      shiftKey: true,
      ctrlOrMetaKey: false
    });
    expect(result).toEqual({
      selectedIds: new Set([1, 2, 3, 4]),
      anchorId: 1,
      shouldOpen: false
    });
  });
});

describe('orderSelectedIds', () => {
  it('returns selected ids in visible order', () => {
    expect(orderSelectedIds(new Set([30, 10, 20]), [10, 20, 30, 40])).toEqual([10, 20, 30]);
  });
});
