import { describe, expect, it } from 'vitest';
import type { WorkflowAction } from '@harborclient/core/types';
import {
  canMoveWorkflowAction,
  cursorAfterDelete,
  cursorAfterMove,
  deleteWorkflowActionAt,
  swapWorkflowActions
} from './workflowActionEdits';

/**
 * Builds a minimal action fixture keyed by type suffix.
 *
 * @param id - Numeric suffix used in the type string.
 * @returns Workflow action.
 */
function action(id: number): WorkflowAction {
  return { type: `step.${id}`, payload: { id } };
}

describe('canMoveWorkflowAction', () => {
  it('allows ahead only when an earlier action exists', () => {
    expect(canMoveWorkflowAction(0, 3, 'ahead')).toBe(false);
    expect(canMoveWorkflowAction(1, 3, 'ahead')).toBe(true);
  });

  it('allows behind only when a later action exists', () => {
    expect(canMoveWorkflowAction(2, 3, 'behind')).toBe(false);
    expect(canMoveWorkflowAction(1, 3, 'behind')).toBe(true);
  });

  it('rejects out-of-range indices', () => {
    expect(canMoveWorkflowAction(-1, 2, 'ahead')).toBe(false);
    expect(canMoveWorkflowAction(2, 2, 'behind')).toBe(false);
  });
});

describe('swapWorkflowActions', () => {
  it('moves an action ahead of its predecessor', () => {
    const actions = [action(1), action(2), action(3)];
    expect(swapWorkflowActions(actions, 1, 'ahead')).toEqual([action(2), action(1), action(3)]);
  });

  it('moves an action behind its successor', () => {
    const actions = [action(1), action(2), action(3)];
    expect(swapWorkflowActions(actions, 1, 'behind')).toEqual([action(1), action(3), action(2)]);
  });

  it('returns null when the move is impossible', () => {
    const actions = [action(1), action(2)];
    expect(swapWorkflowActions(actions, 0, 'ahead')).toBeNull();
    expect(swapWorkflowActions(actions, 1, 'behind')).toBeNull();
  });
});

describe('deleteWorkflowActionAt', () => {
  it('removes the action at the given index', () => {
    const actions = [action(1), action(2), action(3)];
    expect(deleteWorkflowActionAt(actions, 1)).toEqual([action(1), action(3)]);
  });

  it('returns null for an out-of-range index', () => {
    expect(deleteWorkflowActionAt([action(1)], 1)).toBeNull();
  });
});

describe('cursorAfterMove', () => {
  it('follows the moved action', () => {
    expect(cursorAfterMove(2, 'ahead')).toBe(1);
    expect(cursorAfterMove(1, 'behind')).toBe(2);
  });
});

describe('cursorAfterDelete', () => {
  it('clamps to zero when the workflow becomes empty', () => {
    expect(cursorAfterDelete(0, 0, 0)).toBe(0);
  });

  it('keeps the cursor on the next action when deleting the active one', () => {
    expect(cursorAfterDelete(1, 1, 2)).toBe(1);
  });

  it('shifts the cursor left when an earlier action is deleted', () => {
    expect(cursorAfterDelete(2, 0, 2)).toBe(1);
  });

  it('clamps when deleting the last action while on it', () => {
    expect(cursorAfterDelete(2, 2, 2)).toBe(2);
  });
});
