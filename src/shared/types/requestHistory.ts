import type { BodyType } from '#/shared/types/common';

/**
 * Maximum entries persisted and shown in the History sidebar.
 */
export const REQUEST_HISTORY_CAP = 100;

/**
 * Serializable query parameter captured from a sent request.
 */
export interface RequestHistoryParam {
  /**
   * Query parameter name.
   */
  key: string;

  /**
   * Query parameter value.
   */
  value: string;
}

/**
 * One recorded HTTP exchange shown in the History sidebar.
 */
export interface RequestHistoryEntry {
  /**
   * Numeric id unique within the renderer session (timestamp + sequence).
   */
  id: number;

  /**
   * HTTP method (GET, POST, etc.).
   */
  method: string;

  /**
   * Request URL without query parameters at capture time.
   */
  url: string;

  /**
   * HTTP response status code.
   */
  status: number;

  /**
   * HTTP response status text.
   */
  statusText: string;

  /**
   * Unix epoch milliseconds when the response was received.
   */
  ts: number;

  /**
   * Saved collection request id when the send came from a collection request tab.
   */
  savedRequestId?: number;

  /**
   * Display label shown in the sidebar row.
   */
  name?: string;

  /**
   * Outgoing request headers captured at send time.
   */
  headers?: Record<string, string>;

  /**
   * Outgoing query parameters captured at send time.
   */
  params?: RequestHistoryParam[];

  /**
   * Outgoing request body captured at send time.
   */
  body?: string;

  /**
   * Request body content type captured at send time.
   */
  bodyType?: BodyType;

  /**
   * Entry kind. Absent or `'request'` is a single HTTP send; `'run'` is a collection runner run.
   */
  kind?: 'request' | 'run';

  /**
   * Collection id for a run entry. Used to reopen the collection runner tab.
   */
  runCollectionId?: number;

  /**
   * Folder id for a run entry scoped to a folder, or null for collection-wide runs.
   */
  runFolderId?: number | null;

  /**
   * Saved request id for a run entry scoped to one request, or null otherwise.
   */
  runRequestId?: number | null;
}
