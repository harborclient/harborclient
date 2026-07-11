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
 * Returns whether runner state matches the page tab target identity.
 *
 * @param runner - Active collection runner state, if any.
 * @param target - Page tab target identity.
 * @returns True when both refer to the same collection, folder, or request run.
 */
export function runnerMatchesTarget(
  runner: ReturnType<typeof selectCollectionRunner>,
  target: RunnerTargetRef
): boolean {
  if (!runner) {
    return false;
  }
  return (
    runner.collectionId === target.collectionId &&
    runner.folderId === (target.folderId ?? null) &&
    runner.requestId === (target.requestId ?? null)
  );
}
