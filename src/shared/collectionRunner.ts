import type {
  Folder,
  HttpMethod,
  SavedRequest,
  ScriptTestResult,
  ScriptExecutionEvent,
  SendResult
} from '#/shared/types';

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
   * HTTP verb for the saved request (GET, POST, etc.).
   */
  requestMethod: HttpMethod;

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

  /**
   * Full HTTP response from the last send, when available.
   */
  response?: SendResult | null;

  /**
   * hc.test results from pre/post scripts for the last send.
   */
  testResults?: ScriptTestResult[];

  /**
   * Console output captured from scripts for the last send.
   */
  scriptLogs?: string[];

  /**
   * Ordered variable and flow-control activity from scripts for the last send.
   */
  executionEvents?: ScriptExecutionEvent[];

  /**
   * Aggregated script runtime errors from the last send.
   */
  scriptError?: string;

  /**
   * Request URL used for the last send (for response preview plugins).
   */
  requestUrl?: string;
}

/**
 * Discriminator for portable collection or request run-results export files.
 */
export type RunResultsExportKind = 'collection-run-results' | 'request-run-results';

/**
 * Environment settings stored in a run-results export file.
 */
export interface RunResultsExportEnvironment {
  /**
   * Whether the run used the active environment or an override.
   */
  mode: CollectionRunnerEnvironmentMode;

  /**
   * Override environment database id, or null when mode is active.
   */
  id: number | null;

  /**
   * Human-readable environment name at export time.
   */
  name: string | null;
}

/**
 * Collection metadata stored in a run-results export file.
 */
export interface RunResultsExportCollection {
  /**
   * Stable portable collection identifier.
   */
  uuid: string;

  /**
   * Display name of the collection at export time.
   */
  name: string;

  /**
   * Folder name when the run targeted a folder; omitted for collection-wide runs.
   */
  folderName?: string | null;
}

/**
 * Request metadata stored in a single-request run-results export file.
 */
export interface RunResultsExportRequest {
  /**
   * Stable portable request identifier.
   */
  uuid: string;

  /**
   * Display name of the request at export time.
   */
  name: string;

  /**
   * HTTP verb for the saved request.
   */
  method: HttpMethod;
}

/**
 * Portable export file for collection or request runner results.
 */
export interface RunResultsExport {
  /**
   * HarborClient export schema version for forward compatibility.
   */
  harborclientVersion: 1;

  /**
   * Discriminator identifying collection-wide or single-request run results.
   */
  harborclientExport: RunResultsExportKind;

  /**
   * Milliseconds waited between requests during the run.
   */
  delay: number;

  /**
   * Whether the run stopped after the first failure.
   */
  stopOnFailure: boolean;

  /**
   * Environment mode and identity used during the run.
   */
  environment: RunResultsExportEnvironment;

  /**
   * Collection metadata when the export includes collection context.
   */
  collection?: RunResultsExportCollection;

  /**
   * Request metadata when the export is a single-request run.
   */
  request?: RunResultsExportRequest;

  /**
   * Per-request outcome rows from the completed run.
   */
  results: CollectionRunnerRequestResult[];
}

/**
 * Inputs for building a portable run-results export payload.
 */
export interface BuildRunResultsExportArgs {
  /**
   * When set, the export is a single-request run.
   */
  requestId: number | null;

  /**
   * Collection display name at export time.
   */
  collectionName: string;

  /**
   * Folder display name when the run targeted a folder.
   */
  folderName: string | null;

  /**
   * Request display name when the run targeted one request.
   */
  requestName: string | null;

  /**
   * Portable collection uuid, when available.
   */
  collectionUuid: string | null;

  /**
   * Portable request uuid for single-request runs.
   */
  requestUuid: string | null;

  /**
   * HTTP method for single-request runs.
   */
  requestMethod: HttpMethod | null;

  /**
   * Runner delay-between-requests setting in milliseconds.
   */
  delayMs: number;

  /**
   * Runner stop-on-failure setting.
   */
  stopOnFailure: boolean;

  /**
   * Runner environment mode at export time.
   */
  environmentMode: CollectionRunnerEnvironmentMode;

  /**
   * Override environment id when mode is override.
   */
  environmentId: number | null;

  /**
   * Human-readable environment name at export time.
   */
  environmentName: string | null;

  /**
   * Completed per-request result rows to serialize.
   */
  results: CollectionRunnerRequestResult[];
}

/**
 * Summary metadata for a persisted run result row (list views omit the full payload).
 */
export interface SavedRunResultSummary {
  /**
   * Global id encoded with the provider slot namespace.
   */
  id: number;

  /**
   * Stable portable identifier used in deep links and deduplication.
   */
  uuid: string;

  /**
   * Storage connection id (database connection or team hub) that owns the snapshot.
   */
  connectionId: string;

  /**
   * User-facing label for sidebar and list rows.
   */
  label: string;

  /**
   * Whether the snapshot is a collection-wide or single-request run.
   */
  kind: RunResultsExportKind;

  /**
   * Collection display name captured at save time.
   */
  collectionName: string | null;

  /**
   * Request display name when the run targeted one request.
   */
  requestName: string | null;

  /**
   * Pass/fail/skip counts derived from the saved result rows.
   */
  summary: CollectionRunnerSummary;

  /**
   * ISO timestamp when the run result was saved.
   */
  createdAt: string;
}

/**
 * Full persisted run result including the portable export payload.
 */
export interface SavedRunResult extends SavedRunResultSummary {
  /**
   * Complete run-results export body stored with the snapshot.
   */
  payload: RunResultsExport;
}

/**
 * Provider-local run result metadata without connection routing fields.
 */
export interface ProviderRunResultSummary {
  /**
   * Provider-local numeric id.
   */
  id: number;

  /**
   * Stable portable identifier used in deep links and deduplication.
   */
  uuid: string;

  /**
   * User-facing label for sidebar and list rows.
   */
  label: string;

  /**
   * Whether the snapshot is a collection-wide or single-request run.
   */
  kind: RunResultsExportKind;

  /**
   * Collection display name captured at save time.
   */
  collectionName: string | null;

  /**
   * Request display name when the run targeted one request.
   */
  requestName: string | null;

  /**
   * Pass/fail/skip counts derived from the saved result rows.
   */
  summary: CollectionRunnerSummary;

  /**
   * ISO timestamp when the run result was saved.
   */
  createdAt: string;
}

/**
 * Provider-local run result including the stored export payload.
 */
export interface ProviderRunResult extends ProviderRunResultSummary {
  /**
   * Complete run-results export body stored with the snapshot.
   */
  payload: RunResultsExport;
}

/**
 * Inputs for saving a run result to a storage provider.
 */
export interface SaveRunResultInput {
  /**
   * Optional display label; generated from payload metadata when omitted.
   */
  label?: string;

  /**
   * Portable export payload to persist.
   */
  payload: RunResultsExport;
}

/**
 * Aggregate pass/fail counts derived from runner result rows.
 */
export interface CollectionRunnerSummary {
  /**
   * Number of requests that passed.
   */
  passed: number;

  /**
   * Number of requests that failed.
   */
  failed: number;

  /**
   * Number of requests that were skipped.
   */
  skipped: number;
}

/**
 * Counts passed, failed, and skipped rows from a result list.
 *
 * @param results - Runner result rows, typically from a completed or imported run.
 * @returns Summary counts for progress display and import hydration.
 */
export function summarizeRunnerResults(
  results: CollectionRunnerRequestResult[]
): CollectionRunnerSummary {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const result of results) {
    if (result.status === 'passed') {
      passed += 1;
    } else if (result.status === 'failed') {
      failed += 1;
    } else if (result.status === 'skipped') {
      skipped += 1;
    }
  }
  return { passed, failed, skipped };
}

/**
 * Builds a portable run-results export from active runner state and resolved entity metadata.
 *
 * @param args - Runner configuration, target names, and completed result rows.
 * @returns JSON-serializable export payload for save-to-disk.
 */
export function buildRunResultsExport(args: BuildRunResultsExportArgs): RunResultsExport {
  const isRequestRun = args.requestId != null;
  const exportKind: RunResultsExportKind = isRequestRun
    ? 'request-run-results'
    : 'collection-run-results';

  const payload: RunResultsExport = {
    harborclientVersion: 1,
    harborclientExport: exportKind,
    delay: args.delayMs,
    stopOnFailure: args.stopOnFailure,
    environment: {
      mode: args.environmentMode,
      id: args.environmentMode === 'override' ? args.environmentId : null,
      name: args.environmentName
    },
    results: args.results
  };

  if (args.collectionUuid) {
    payload.collection = {
      uuid: args.collectionUuid,
      name: args.collectionName,
      ...(args.folderName ? { folderName: args.folderName } : {})
    };
  }

  if (isRequestRun && args.requestUuid && args.requestName && args.requestMethod) {
    payload.request = {
      uuid: args.requestUuid,
      name: args.requestName,
      method: args.requestMethod
    };
  }

  return payload;
}

/**
 * Builds a default sidebar label from run-results export metadata.
 *
 * @param payload - Saved or exported run-results body.
 * @returns Short human-readable label for list rows.
 */
export function buildSavedRunLabel(payload: RunResultsExport): string {
  const target =
    payload.request?.name ?? payload.collection?.folderName ?? payload.collection?.name ?? 'Run';
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  return `${target} — ${timestamp}`;
}

/**
 * Derives list metadata from a run-results export payload.
 *
 * @param payload - Portable export body being saved.
 * @returns Kind, names, and summary counts for persistence and list views.
 */
export function extractSavedRunMetadata(payload: RunResultsExport): {
  kind: RunResultsExportKind;
  collectionName: string | null;
  requestName: string | null;
  summary: CollectionRunnerSummary;
} {
  return {
    kind: payload.harborclientExport,
    collectionName: payload.collection?.name ?? null,
    requestName: payload.request?.name ?? null,
    summary: summarizeRunnerResults(payload.results)
  };
}

/**
 * Resolves local collection and request ids from portable uuids in an import file.
 *
 * @param data - Parsed run-results export from disk.
 * @param collections - Collections currently loaded in the workspace.
 * @param requestsByCollection - Saved requests keyed by collection id.
 * @returns Local ids when matches exist, or detached placeholders when not found.
 */
export function resolveImportedRunnerTargetIds(
  data: RunResultsExport,
  collections: Array<{ id: number; uuid: string }>,
  requestsByCollection: Record<number, Array<{ id: number; uuid: string }>>
): { collectionId: number; requestId: number | null } {
  let collectionId = 0;
  if (data.collection?.uuid) {
    const collection = collections.find((item) => item.uuid === data.collection?.uuid);
    if (collection) {
      collectionId = collection.id;
    }
  }

  let requestId: number | null = null;
  if (data.request?.uuid) {
    const searchCollectionIds =
      collectionId > 0 ? [collectionId] : Object.keys(requestsByCollection).map(Number);
    for (const id of searchCollectionIds) {
      const match = (requestsByCollection[id] ?? []).find(
        (request) => request.uuid === data.request?.uuid
      );
      if (match) {
        collectionId = id;
        requestId = match.id;
        break;
      }
    }
  }

  return { collectionId, requestId };
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
 * Returns saved requests for a collection runner target, optionally scoped to one request.
 *
 * @param collectionId - Collection whose requests are included.
 * @param folderId - When set, only requests in that folder; otherwise full collection order.
 * @param requestId - When set, returns only that request if it exists in the collection.
 * @param requests - All saved requests for the collection (already loaded in Redux).
 * @param folders - Folders for the collection (already loaded in Redux).
 * @returns Requests ordered for sequential execution.
 */
export function getCollectionRunnerRequests(
  collectionId: number,
  folderId: number | null | undefined,
  requestId: number | null | undefined,
  requests: SavedRequest[],
  folders: Folder[]
): SavedRequest[] {
  if (requestId != null) {
    const match = requests.find(
      (request) => request.collection_id === collectionId && request.id === requestId
    );
    return match ? [match] : [];
  }

  return getRequestsInRunOrder(collectionId, folderId, requests, folders);
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
    requestMethod: request.method,
    status: 'pending',
    testsPassed: 0,
    testsFailed: 0
  }));
}

/**
 * Resolves the next request index after a collection runner step.
 *
 * @param orderedRequests - Requests in run order for the active target.
 * @param currentIndex - Index of the request that just finished.
 * @param nextRequest - Directive from hc.execution.setNextRequest, if any.
 * @returns Next index to run, or null to stop the run.
 */
export function resolveCollectionRunnerNextIndex(
  orderedRequests: SavedRequest[],
  currentIndex: number,
  nextRequest: string | null | undefined
): number | null {
  if (nextRequest === null) {
    return null;
  }

  if (nextRequest === undefined) {
    const next = currentIndex + 1;
    return next < orderedRequests.length ? next : null;
  }

  const matchIndex = orderedRequests.findIndex((request) => request.name === nextRequest);
  if (matchIndex >= 0) {
    return matchIndex;
  }

  const fallback = currentIndex + 1;
  return fallback < orderedRequests.length ? fallback : null;
}
