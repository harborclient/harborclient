import type { Folder, SavedRequest, ScriptTestResult } from '#/shared/types';

/**
 * How the collection runner resolves variables during a run.
 */
export type CollectionRunnerEnvironmentMode = 'active' | 'override';

/**
 * User-configurable settings persisted between collection runner sessions.
 */
export interface CollectionRunnerConfig {
  /**
   * Milliseconds to wait after each request completes before starting the next.
   */
  delayMs: number;

  /**
   * When true, the run stops after the first HTTP or test failure.
   */
  stopOnFailure: boolean;

  /**
   * Whether to use the globally active environment or a runner-specific override.
   */
  environmentMode: CollectionRunnerEnvironmentMode;

  /**
   * Environment id used when {@link CollectionRunnerConfig.environmentMode} is override.
   */
  environmentId: number | null;
}

/**
 * Default collection runner settings for first launch and normalization fallbacks.
 */
export const DEFAULT_COLLECTION_RUNNER_CONFIG: CollectionRunnerConfig = {
  delayMs: 0,
  stopOnFailure: false,
  environmentMode: 'active',
  environmentId: null
};

/**
 * Per-request outcome status shown in the collection runner modal.
 */
export type CollectionRunnerResultStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

/**
 * Summary row for one request in a collection run.
 */
export interface CollectionRunnerRequestResult {
  /**
   * Saved request database id.
   */
  requestId: number;

  /**
   * Display name shown in the sidebar.
   */
  requestName: string;

  /**
   * Current status for this row in the run list.
   */
  status: CollectionRunnerResultStatus;

  /**
   * HTTP status code when a response was received.
   */
  httpStatus?: number;

  /**
   * Transport or script error message when the send did not succeed cleanly.
   */
  httpError?: string;

  /**
   * Count of passing hc.test assertions from the last send.
   */
  testsPassed: number;

  /**
   * Count of failing hc.test assertions from the last send.
   */
  testsFailed: number;
}

/**
 * Normalizes persisted or partial collection runner config from storage.
 *
 * @param input - Raw config from electron-store or user edits.
 * @returns Sanitized config with safe defaults applied.
 */
export function normalizeCollectionRunnerConfig(
  input: Partial<CollectionRunnerConfig> | null | undefined
): CollectionRunnerConfig {
  const delayMs = Number(input?.delayMs ?? DEFAULT_COLLECTION_RUNNER_CONFIG.delayMs);
  const environmentMode =
    input?.environmentMode === 'override'
      ? 'override'
      : DEFAULT_COLLECTION_RUNNER_CONFIG.environmentMode;
  const environmentCandidate = input?.environmentId == null ? null : Number(input.environmentId);
  const environmentId =
    environmentMode === 'override' &&
    Number.isInteger(environmentCandidate) &&
    (environmentCandidate as number) > 0
      ? (environmentCandidate as number)
      : null;

  return {
    delayMs: Number.isFinite(delayMs) && delayMs >= 0 ? Math.floor(delayMs) : 0,
    stopOnFailure: Boolean(input?.stopOnFailure),
    environmentMode,
    environmentId
  };
}

/**
 * Returns saved requests in sidebar run order for a collection or folder target.
 *
 * @param collectionId - Collection whose requests are included.
 * @param folderId - When set, only requests in that folder; otherwise full collection order.
 * @param requests - All saved requests for the collection (already loaded in Redux).
 * @param folders - Folders for the collection (already loaded in Redux).
 * @returns Requests ordered for sequential execution.
 */
export function getRequestsInRunOrder(
  collectionId: number,
  folderId: number | null | undefined,
  requests: SavedRequest[],
  folders: Folder[]
): SavedRequest[] {
  const collectionRequests = requests.filter((request) => request.collection_id === collectionId);

  const sortRequests = (items: SavedRequest[]): SavedRequest[] =>
    [...items].sort(
      (left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name)
    );

  if (folderId != null) {
    return sortRequests(collectionRequests.filter((request) => request.folder_id === folderId));
  }

  const rootRequests = sortRequests(
    collectionRequests.filter((request) => request.folder_id == null)
  );

  const sortedFolders = [...folders]
    .filter((folder) => folder.collection_id === collectionId)
    .sort(
      (left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name)
    );

  const nestedRequests = sortedFolders.flatMap((folder) =>
    sortRequests(collectionRequests.filter((request) => request.folder_id === folder.id))
  );

  return [...rootRequests, ...nestedRequests];
}

/**
 * Returns test pass/fail counts for a script test result list.
 *
 * @param testResults - hc.test results from the last send.
 * @returns Counts of passing and failing assertions.
 */
export function countTestResults(testResults: ScriptTestResult[]): {
  testsPassed: number;
  testsFailed: number;
} {
  let testsPassed = 0;
  let testsFailed = 0;
  for (const test of testResults) {
    if (test.passed) {
      testsPassed += 1;
    } else {
      testsFailed += 1;
    }
  }
  return { testsPassed, testsFailed };
}

/**
 * Determines whether a completed send should count as a runner failure.
 *
 * @param response - HTTP response from the last send, if any.
 * @param testResults - hc.test results from pre/post scripts.
 * @returns True when stop-on-failure should halt the run.
 */
export function isCollectionRunnerRequestFailure(
  response: { status: number; error?: string } | null | undefined,
  testResults: ScriptTestResult[]
): boolean {
  if (response?.error) {
    return true;
  }
  if (response != null && response.status >= 400) {
    return true;
  }
  return testResults.some((test) => !test.passed);
}

/**
 * Builds initial pending result rows for a collection run.
 *
 * @param requests - Ordered requests that will be executed.
 * @returns Pending result rows aligned with run order.
 */
export function buildPendingCollectionRunnerResults(
  requests: SavedRequest[]
): CollectionRunnerRequestResult[] {
  return requests.map((request) => ({
    requestId: request.id,
    requestName: request.name,
    status: 'pending',
    testsPassed: 0,
    testsFailed: 0
  }));
}
