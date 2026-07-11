import { type CollectionRunnerRequestResult } from '#/shared/collectionRunner';
import { selectCollectionRunner } from '#/renderer/src/store/slices/modalsSlice';
import { type RunnerTargetRef } from '#/renderer/src/ui/CollectionRunner/resolveRunnerTargetName';

/**
 * Returns a human-readable label for a collection runner result row.
 *
 * @param result - Result row from the active collection run.
 * @returns Status text paired with color indicators elsewhere in the UI.
 */
export function resultStatusLabel(result: CollectionRunnerRequestResult): string {
  switch (result.status) {
    case 'pending':
      return 'Pending';
    case 'running':
      return 'Running…';
    case 'passed':
      return 'Passed';
    case 'failed':
      if (result.httpError) {
        return `Failed: ${result.httpError}`;
      }
      if (result.httpStatus != null && result.httpStatus >= 400) {
        return `Failed: HTTP ${result.httpStatus}`;
      }
      if (result.testsFailed > 0) {
        return `Failed: ${result.testsFailed} test${result.testsFailed === 1 ? '' : 's'} failed`;
      }
      return 'Failed';
    case 'skipped':
      return 'Skipped';
  }
}

/**
 * Returns whether two request id lists match in order and membership.
 *
 * @param left - First request id list.
 * @param right - Second request id list.
 * @returns True when both lists contain the same ids in the same order.
 */
function requestIdListsMatch(
  left: number[] | null | undefined,
  right: number[] | null | undefined
): boolean {
  if (left == null || right == null) {
    return left == null && right == null;
  }
  if (left.length !== right.length) {
    return false;
  }
  return left.every((id, index) => id === right[index]);
}

/**
 * Returns whether runner state matches the page tab target identity.
 *
 * @param runner - Active collection runner state, if any.
 * @param target - Page tab target identity.
 * @returns True when both refer to the same collection, folder, request, or selection run.
 */
export function runnerMatchesTarget(
  runner: ReturnType<typeof selectCollectionRunner>,
  target: RunnerTargetRef
): boolean {
  if (!runner) {
    return false;
  }

  if (runner.requestIds != null || target.requestIds != null) {
    return (
      runner.collectionId === target.collectionId &&
      requestIdListsMatch(runner.requestIds, target.requestIds)
    );
  }

  return (
    runner.collectionId === target.collectionId &&
    runner.folderId === (target.folderId ?? null) &&
    runner.requestId === (target.requestId ?? null)
  );
}
