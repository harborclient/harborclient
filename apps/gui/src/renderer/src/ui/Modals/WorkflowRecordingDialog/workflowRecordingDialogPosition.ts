/**
 * localStorage key for the last Workflow Recording dialog position.
 */
export const WORKFLOW_RECORDING_DIALOG_POSITION_KEY =
  'harborclient.workflowRecordingDialog.position';

/**
 * Default corner used when no saved position exists.
 */
export const DEFAULT_WORKFLOW_RECORDING_DIALOG_POSITION = {
  left: 96,
  top: 96
} as const;

/**
 * Saved top-left coordinates for the Workflow Recording dialog.
 */
export interface WorkflowRecordingDialogPosition {
  /**
   * CSS `left` in viewport pixels.
   */
  left: number;

  /**
   * CSS `top` in viewport pixels.
   */
  top: number;
}

/**
 * Reads the last saved Workflow Recording dialog position from localStorage.
 *
 * @returns Parsed position, or `null` when missing or invalid.
 */
export function loadWorkflowRecordingDialogPosition(): WorkflowRecordingDialogPosition | null {
  try {
    const raw = localStorage.getItem(WORKFLOW_RECORDING_DIALOG_POSITION_KEY);
    if (raw == null) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<WorkflowRecordingDialogPosition>;
    if (
      typeof parsed.left !== 'number' ||
      typeof parsed.top !== 'number' ||
      !Number.isFinite(parsed.left) ||
      !Number.isFinite(parsed.top)
    ) {
      return null;
    }
    return { left: parsed.left, top: parsed.top };
  } catch {
    return null;
  }
}

/**
 * Persists the Workflow Recording dialog position to localStorage.
 *
 * @param position - Top-left coordinates to store.
 */
export function saveWorkflowRecordingDialogPosition(
  position: WorkflowRecordingDialogPosition
): void {
  if (!Number.isFinite(position.left) || !Number.isFinite(position.top)) {
    return;
  }
  try {
    localStorage.setItem(
      WORKFLOW_RECORDING_DIALOG_POSITION_KEY,
      JSON.stringify({ left: position.left, top: position.top })
    );
  } catch {
    // Ignore quota / private-mode failures.
  }
}
