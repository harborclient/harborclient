import type { WorkflowRunHistoryEntry } from '../workflowRunHistory';

/**
 * IPC methods for native workflow run history persistence.
 */
export interface ApiWorkflowRunHistory {
  /**
   * Lists persisted workflow run history entries, newest first.
   */
  listWorkflowRunHistory: () => Promise<WorkflowRunHistoryEntry[]>;

  /**
   * Persists a completed workflow run and prunes entries beyond the configured cap.
   *
   * @param entry - Captured run metadata and export payload to store.
   */
  addWorkflowRunHistory: (
    entry: Omit<WorkflowRunHistoryEntry, 'id'> & { id?: number }
  ) => Promise<WorkflowRunHistoryEntry[]>;

  /**
   * Removes all persisted workflow run history entries.
   */
  clearWorkflowRunHistory: () => Promise<void>;

  /**
   * Removes one persisted workflow run history entry by id.
   *
   * @param id - History entry id to delete.
   */
  deleteWorkflowRunHistory: (id: number) => Promise<WorkflowRunHistoryEntry[]>;
}
