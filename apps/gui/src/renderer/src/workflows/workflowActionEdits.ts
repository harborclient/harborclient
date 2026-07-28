import type { WorkflowAction } from '@harborclient/core/types';

/**
 * Direction to swap the active action relative to timeline order.
 *
 * - `ahead` — toward the start of the workflow (lower index)
 * - `behind` — toward the end of the workflow (higher index)
 */
export type WorkflowActionMoveDirection = 'ahead' | 'behind';

/**
 * Returns whether the active action can move in the given direction.
 *
 * @param index - Active 0-based action index.
 * @param actionCount - Total actions in the workflow.
 * @param direction - Move direction relative to timeline order.
 * @returns True when a swap partner exists.
 */
export function canMoveWorkflowAction(
  index: number,
  actionCount: number,
  direction: WorkflowActionMoveDirection
): boolean {
  if (index < 0 || index >= actionCount) {
    return false;
  }
  if (direction === 'ahead') {
    return index > 0;
  }
  return index < actionCount - 1;
}

/**
 * Swaps the action at `index` with its neighbor in the given direction.
 *
 * @param actions - Current ordered actions.
 * @param index - Active action index to move.
 * @param direction - Swap toward start (`ahead`) or end (`behind`).
 * @returns New action array, or null when the move is invalid.
 */
export function swapWorkflowActions(
  actions: readonly WorkflowAction[],
  index: number,
  direction: WorkflowActionMoveDirection
): WorkflowAction[] | null {
  if (!canMoveWorkflowAction(index, actions.length, direction)) {
    return null;
  }
  const swapWith = direction === 'ahead' ? index - 1 : index + 1;
  const next = actions.map((action) => ({ ...action }));
  const temp = next[index]!;
  next[index] = next[swapWith]!;
  next[swapWith] = temp;
  return next;
}

/**
 * Removes the action at `index` from the workflow.
 *
 * @param actions - Current ordered actions.
 * @param index - Action index to delete.
 * @returns New action array, or null when the index is out of range.
 */
export function deleteWorkflowActionAt(
  actions: readonly WorkflowAction[],
  index: number
): WorkflowAction[] | null {
  if (index < 0 || index >= actions.length) {
    return null;
  }
  return actions.filter((_, i) => i !== index).map((action) => ({ ...action }));
}

/**
 * Replaces the payload of the action at `index` without changing `type` or `at`.
 *
 * @param actions - Current ordered actions.
 * @param index - Action index whose payload should be replaced.
 * @param payload - New payload value (any JSON-serializable value).
 * @returns New action array, or null when the index is out of range.
 */
export function updateWorkflowActionPayloadAt(
  actions: readonly WorkflowAction[],
  index: number,
  payload: unknown
): WorkflowAction[] | null {
  if (index < 0 || index >= actions.length) {
    return null;
  }
  return actions.map((action, i) => (i === index ? { ...action, payload } : { ...action }));
}

/**
 * Returns the playback cursor after moving an action so it stays on the moved item.
 *
 * @param index - Index before the move.
 * @param direction - Direction the action was moved.
 * @returns New cursor index.
 */
export function cursorAfterMove(index: number, direction: WorkflowActionMoveDirection): number {
  return direction === 'ahead' ? index - 1 : index + 1;
}

/**
 * Clamps the playback cursor after deleting an action.
 *
 * @param cursor - Cursor before deletion.
 * @param deletedIndex - Index that was removed.
 * @param newLength - Action count after deletion.
 * @returns Cursor clamped to `[0, newLength]`.
 */
export function cursorAfterDelete(cursor: number, deletedIndex: number, newLength: number): number {
  if (newLength <= 0) {
    return 0;
  }
  let next = cursor;
  if (deletedIndex < cursor) {
    next = cursor - 1;
  } else if (deletedIndex === cursor) {
    next = cursor;
  }
  return Math.min(Math.max(next, 0), newLength);
}
