import type { RequestHistoryEntry } from '#/shared/types/requestHistory';

/**
 * IPC methods for native request history persistence.
 */
export interface ApiRequestHistory {
  /**
   * Lists persisted request history entries, newest first.
   */
  listRequestHistory: () => Promise<RequestHistoryEntry[]>;

  /**
   * Persists a completed request and prunes entries beyond the configured cap.
   *
   * @param entry - Captured request/response metadata to store.
   */
  addRequestHistory: (entry: RequestHistoryEntry) => Promise<RequestHistoryEntry[]>;

  /**
   * Removes all persisted request history entries.
   */
  clearRequestHistory: () => Promise<void>;

  /**
   * Removes one persisted request history entry by id.
   *
   * @param id - History entry id to delete.
   */
  deleteRequestHistory: (id: number) => Promise<RequestHistoryEntry[]>;
}
