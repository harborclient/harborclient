import { describe, expect, it } from 'vitest';
import type { TabGroup } from '#/shared/types/tabGroup';
import tabGroupReducer, { reorderTabGroupsLocal } from '#/renderer/src/store/slices/tabGroupSlice';
import type { TabGroupState } from '#/renderer/src/store/slices/tabGroupSlice';

const baseTabGroup = (overrides: Partial<TabGroup> & Pick<TabGroup, 'id' | 'name'>): TabGroup => ({
  requests: [],
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

const reorderState = (): TabGroupState => ({
  items: [baseTabGroup({ id: 1, name: 'Alpha' }), baseTabGroup({ id: 2, name: 'Beta' })],
  editingTabGroupId: null,
  editSessionHiddenTabIds: []
});

describe('tabGroupSlice reorderTabGroupsLocal', () => {
  it('reorders tab groups to match the payload', () => {
    const state = tabGroupReducer(reorderState(), reorderTabGroupsLocal([2, 1]));

    expect(state.items.map((group) => group.id)).toEqual([2, 1]);
  });

  it('ignores invalid reorder payloads', () => {
    const initial = reorderState();
    const state = tabGroupReducer(initial, reorderTabGroupsLocal([1]));

    expect(state.items.map((group) => group.id)).toEqual(initial.items.map((group) => group.id));
  });
});
