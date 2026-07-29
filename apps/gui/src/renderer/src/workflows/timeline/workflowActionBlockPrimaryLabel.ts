import type { WorkflowAction, WorkflowRunActionResult } from '@harborclient/core/types';
import type { RootState } from '#/renderer/src/store/redux';
import { describeWorkflowAction } from '#/renderer/src/workflows/timeline/workflowThumbnails';
import { isWorkflowRunRequestResult } from '#/renderer/src/workflows/isWorkflowRunRequestResult';

/**
 * Builds the primary accessible label for a workflow action row.
 *
 * Prefers method + name from a request-result snapshot when present.
 *
 * @param action - Workflow action.
 * @param result - Optional run-log result.
 * @param getState - Optional Redux getter for descriptions.
 * @returns Primary label without index or timing.
 */
export function workflowActionBlockPrimaryLabel(
  action: WorkflowAction,
  result: WorkflowRunActionResult | undefined,
  getState?: () => RootState
): string {
  const requestResult =
    action.type === 'request.send' && result != null && isWorkflowRunRequestResult(result)
      ? result
      : null;
  const described = describeWorkflowAction(action, {
    selected: false,
    compact: false,
    getState,
    result
  });
  if (requestResult != null) {
    return `${requestResult.method} ${requestResult.name}`;
  }
  if (described.subtitle != null && described.subtitle.length > 0) {
    return `${described.title}, ${described.subtitle}`;
  }
  return described.title;
}
