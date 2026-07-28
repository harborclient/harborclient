import type { WorkflowAction } from '@harborclient/core/types';

/**
 * Resolves the next playback index after a workflow action finishes.
 *
 * @param actions - Ordered workflow actions for the loaded session.
 * @param currentIndex - Index of the action that just finished.
 * @param workflowNextAction - UUID from hc.execution.workflowNextAction, if any.
 * @returns Next index to play, or null when playback should stop.
 */
export function resolveWorkflowNextIndex(
  actions: readonly WorkflowAction[],
  currentIndex: number,
  workflowNextAction: string | undefined
): number | null {
  if (workflowNextAction === undefined) {
    const next = currentIndex + 1;
    return next < actions.length ? next : null;
  }

  const matchIndex = actions.findIndex((action) => action.uuid === workflowNextAction);
  if (matchIndex >= 0) {
    return matchIndex;
  }

  const fallback = currentIndex + 1;
  return fallback < actions.length ? fallback : null;
}
