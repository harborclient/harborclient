import type { WorkflowTabIdentity } from './workflowIdentity';

let pendingTabCloseIdentity: WorkflowTabIdentity | null = null;

/**
 * Stores a portable tab identity captured before `closeTab` removes the tab.
 *
 * @param identity - Identity to use for the next closeTab record, or null.
 */
export function prepareTabCloseRecording(identity: WorkflowTabIdentity | null): void {
  pendingTabCloseIdentity = identity;
}

/**
 * Consumes and clears the pending tab-close identity for recording.
 *
 * @returns Identity captured before close, or null.
 */
export function takePendingTabCloseIdentity(): WorkflowTabIdentity | null {
  const identity = pendingTabCloseIdentity;
  pendingTabCloseIdentity = null;
  return identity;
}

/**
 * Clears pending close identity for unit tests.
 */
export function resetTabCloseRecordingForTests(): void {
  pendingTabCloseIdentity = null;
}
