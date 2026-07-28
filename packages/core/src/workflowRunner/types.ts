import type { WorkflowAction, WorkflowRunActionResult, WorkflowRunExport } from '../types/workflow';

/**
 * Plays one workflow action during a shared {@link runWorkflow} session.
 */
export interface WorkflowActionExecutor {
  /**
   * Executes a single recorded action.
   *
   * @param action - Workflow action at the current cursor.
   * @param index - 0-based action index.
   * @returns Optional play result (e.g. send outcome) for the run log.
   */
  play(action: WorkflowAction, index: number): Promise<unknown>;
}

/**
 * One executed workflow step captured in exact run order.
 */
export interface WorkflowRunnerLogEntry {
  /**
   * The workflow action that was played.
   */
  action: WorkflowAction;

  /**
   * Export entry for this step (request result or raw payload).
   */
  result: WorkflowRunActionResult;
}

/**
 * Options for {@link runWorkflow}.
 */
export interface WorkflowRunnerOptions {
  /**
   * Ordered actions to play.
   */
  actions: readonly WorkflowAction[];

  /**
   * Portable workflow UUID for hc.info during script runs.
   */
  workflowUuid: string;

  /**
   * Display name used in the workflow-run export envelope.
   */
  workflowName: string;

  /**
   * Active environment UUID recorded at run start (empty when none).
   */
  environmentUuid?: string;

  /**
   * Pause between consecutive actions in milliseconds.
   */
  delayMs?: number;

  /**
   * When true (default), skip recorded `at` timing gaps.
   */
  gapless?: boolean;

  /**
   * 0-based index to start from (default 0).
   */
  startIndex?: number;

  /**
   * When true, stop after the first failed request.send outcome.
   */
  stopOnFailure?: boolean;

  /**
   * Pluggable action executor (GUI Redux or headless).
   */
  executor: WorkflowActionExecutor;

  /**
   * Maps a play-handler return value into a run-log result entry.
   *
   * Defaults to returning `action.payload` when omitted or when the mapper
   * returns undefined.
   *
   * @param action - Action that just played.
   * @param playResult - Value returned by {@link WorkflowActionExecutor.play}.
   * @returns Export entry for the run log.
   */
  resolveLogResult?: (
    action: WorkflowAction,
    playResult: unknown
  ) => WorkflowRunActionResult | undefined;

  /**
   * Called when the playback cursor changes (before a step or after advancing).
   *
   * @param index - Current 0-based cursor.
   */
  onIndexChange?: (index: number) => void;

  /**
   * Called after each completed step is appended to the run log.
   *
   * @param entry - Logged step.
   * @param index - Index that just finished.
   */
  onStepComplete?: (entry: WorkflowRunnerLogEntry, index: number) => void;

  /**
   * Returns true when the host wants to abort the loop (e.g. GUI stop).
   */
  shouldStop?: () => boolean;

  /**
   * Host-controlled wait. Resolves true when the full wait completed; false when
   * cancelled. Defaults to `setTimeout`.
   *
   * @param ms - Milliseconds to wait.
   * @returns Whether the wait completed without cancellation.
   */
  waitMs?: (ms: number) => Promise<boolean>;

  /**
   * Optional ISO-8601 start timestamp for the export (defaults to now).
   */
  dateCreated?: string;
}

/**
 * Outcome of a completed or aborted {@link runWorkflow} call.
 */
export interface WorkflowRunnerResult {
  /**
   * True when every action ran (or was skipped) through a natural end.
   */
  completed: boolean;

  /**
   * True when {@link WorkflowRunnerOptions.shouldStop} aborted mid-run.
   */
  stoppedEarly: boolean;

  /**
   * True when stop-on-failure halted after a failed send.
   */
  stoppedOnFailure: boolean;

  /**
   * Cursor after the run (typically `actions.length` when finished).
   */
  lastIndex: number;

  /**
   * Count of failed request.send steps.
   */
  failures: number;

  /**
   * Error thrown by an executor step, when the run aborted due to throw.
   */
  error?: unknown;

  /**
   * Portable workflow-run export for the executed steps.
   */
  export: WorkflowRunExport;

  /**
   * Ordered run-log entries.
   */
  entries: WorkflowRunnerLogEntry[];
}
