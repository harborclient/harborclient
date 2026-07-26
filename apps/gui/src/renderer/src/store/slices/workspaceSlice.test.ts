import { describe, expect, it } from 'vitest';
import type { Workspace } from '@harborclient/core/types/workspace';
import workspaceReducer, { reorderWorkspacesLocal } from './workspaceSlice';
import type { WorkspaceState } from './workspaceSlice';

const baseWorkspace = (
  overrides: Partial<Workspace> & Pick<Workspace, 'id' | 'name'>
): Workspace => ({
  requests: [],
  createdAt: 1,
  updatedAt: 1,
  ...overrides
});

const reorderState = (): WorkspaceState => ({
  items: [baseWorkspace({ id: 1, name: 'Alpha' }), baseWorkspace({ id: 2, name: 'Beta' })]
});

describe('workspaceSlice reorderWorkspacesLocal', () => {
  it('reorders workspaces to match the payload', () => {
    const state = workspaceReducer(reorderState(), reorderWorkspacesLocal([2, 1]));

    expect(state.items.map((group) => group.id)).toEqual([2, 1]);
  });

  it('ignores invalid reorder payloads', () => {
    const initial = reorderState();
    const state = workspaceReducer(initial, reorderWorkspacesLocal([1]));

    expect(state.items.map((group) => group.id)).toEqual(initial.items.map((group) => group.id));
  });
});
