import type {
  WorkflowAction,
  WorkflowRunActionResult,
  WorkflowRunExport
} from '@harborclient/core/types';
import { buildWorkflowRunExport } from '@harborclient/core/types';

type RunLogListener = () => void;

/**
 * One executed workflow step captured in exact run order.
 */
export interface WorkflowRunLogEntry {
  /**
   * The workflow action that was played (for timeline block rendering).
   */
  action: WorkflowAction;

  /**
   * Export entry for this step (request result or raw payload).
   */
  result: WorkflowRunActionResult;
}

/**
 * Metadata seeded when a workflow run starts from the beginning.
 */
export interface WorkflowRunLogMeta {
  /**
   * Portable workflow uuid for the run session.
   */
  workflowUuid: string;

  /**
   * Display name of the workflow at run start.
   */
  name: string;

  /**
   * Active environment uuid at run start, or empty when none.
   */
  environment: string;

  /**
   * ISO-8601 timestamp when the run started.
   */
  date_created: string;
}

const runLogListeners = new Set<RunLogListener>();

let entries: WorkflowRunLogEntry[] = [];
let meta: WorkflowRunLogMeta | null = null;
/** Monotonic version bumped on every log mutation for external-store subscribers. */
let version = 0;

/**
 * Notifies subscribers that the run log changed.
 */
function notifyRunLogListeners(): void {
  version += 1;
  for (const listener of runLogListeners) {
    listener();
  }
}

/**
 * Clears the in-memory run log and metadata.
 */
export function clearWorkflowRunLog(): void {
  entries = [];
  meta = null;
  notifyRunLogListeners();
}

/**
 * Seeds run metadata for a fresh playback starting at index 0.
 *
 * Clears any previous entries so the log reflects only this run.
 *
 * @param nextMeta - Workflow name, uuid, environment, and start timestamp.
 */
export function beginWorkflowRunLog(nextMeta: WorkflowRunLogMeta): void {
  entries = [];
  meta = { ...nextMeta };
  notifyRunLogListeners();
}

/**
 * Appends one executed action to the run log in execution order.
 *
 * @param action - Workflow action that just finished playing.
 * @param result - Export entry for this step.
 */
export function appendWorkflowRunLogEntry(
  action: WorkflowAction,
  result: WorkflowRunActionResult
): void {
  entries = [...entries, { action: { ...action }, result }];
  notifyRunLogListeners();
}

/**
 * Returns the ordered run-log entries for the current (or last) run.
 *
 * @returns Readonly snapshot of executed steps.
 */
export function getWorkflowRunLog(): readonly WorkflowRunLogEntry[] {
  return entries;
}

/**
 * Returns metadata for the current (or last) run, when a run has started.
 *
 * @returns Run metadata, or null when no run has been seeded.
 */
export function getWorkflowRunLogMeta(): WorkflowRunLogMeta | null {
  return meta == null ? null : { ...meta };
}

/**
 * Returns a monotonic version number that changes whenever the run log mutates.
 *
 * Used with `useSyncExternalStore` so React can subscribe without comparing
 * object snapshots by identity.
 *
 * @returns Current run-log version.
 */
export function getWorkflowRunLogVersion(): number {
  return version;
}

/**
 * Builds a workflow-run export envelope from the current run log.
 *
 * @returns Export object, or null when no run metadata has been seeded.
 */
export function getWorkflowRunExport(): WorkflowRunExport | null {
  if (meta == null) {
    return null;
  }
  return buildWorkflowRunExport({
    name: meta.name,
    environment: meta.environment,
    date_created: meta.date_created,
    actions: entries.map((entry) => entry.result)
  });
}

/**
 * Builds a single-action workflow-run export for the detail modal.
 *
 * @param index - 0-based index into the run log.
 * @returns Export with one action, or null when index/meta is invalid.
 */
export function getWorkflowRunExportForEntry(index: number): WorkflowRunExport | null {
  if (meta == null || index < 0 || index >= entries.length) {
    return null;
  }
  const entry = entries[index];
  if (entry == null) {
    return null;
  }
  return buildWorkflowRunExport({
    name: meta.name,
    environment: meta.environment,
    date_created: meta.date_created,
    actions: [entry.result]
  });
}

/**
 * Subscribes to run-log changes (append, clear, begin).
 *
 * @param listener - Called when the log changes.
 * @returns Unsubscribe function.
 */
export function subscribeWorkflowRunLog(listener: RunLogListener): () => void {
  runLogListeners.add(listener);
  return () => {
    runLogListeners.delete(listener);
  };
}

/**
 * Resets run-log module state for unit tests.
 */
export function resetWorkflowRunLogForTests(): void {
  entries = [];
  meta = null;
  version = 0;
  runLogListeners.clear();
}
