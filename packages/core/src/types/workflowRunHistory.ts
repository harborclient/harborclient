import type { WorkflowAction, WorkflowRunActionResult, WorkflowRunExport } from './workflow';

/**
 * Maximum workflow run history entries persisted and shown in the History sidebar.
 */
export const WORKFLOW_RUN_HISTORY_CAP = 100;

/**
 * One executed step stored with a workflow run history entry for results reopen.
 */
export interface WorkflowRunHistoryStep {
  /**
   * The workflow action that was played.
   */
  action: WorkflowAction;

  /**
   * Export entry for this step (request result or raw payload).
   */
  result: WorkflowRunActionResult;

  /**
   * ISO-8601 timestamp when this step started executing.
   */
  ranAt: string;

  /**
   * Wall-clock duration of the step's play handler in milliseconds.
   */
  durationMs: number;
}

/**
 * JSON payload persisted for one workflow run history row.
 *
 * Includes the portable export envelope plus action-bearing steps so the
 * results page can hydrate the in-memory run log.
 */
export interface WorkflowRunHistoryPayload {
  /**
   * Portable workflow-run export envelope.
   */
  export: WorkflowRunExport;

  /**
   * Ordered executed steps with original actions for UI hydration.
   */
  steps: WorkflowRunHistoryStep[];
}

/**
 * One completed workflow run shown in the Workflows History sidebar.
 */
export interface WorkflowRunHistoryEntry {
  /**
   * Auto-increment primary key in the local registry.
   */
  id: number;

  /**
   * Portable uuid of the workflow that was run.
   */
  workflowUuid: string;

  /**
   * Display name of the workflow at run time.
   */
  name: string;

  /**
   * Active environment uuid at run start, or empty when none was active.
   */
  environment: string;

  /**
   * ISO-8601 timestamp when the run started (from the export envelope).
   */
  dateCreated: string;

  /**
   * Unix epoch milliseconds when the run was recorded into history.
   */
  ts: number;

  /**
   * Full run export plus action steps used to reopen the results page.
   */
  payload: WorkflowRunHistoryPayload;
}
