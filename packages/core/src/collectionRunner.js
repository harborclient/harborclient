/**
 * Default collection runner settings for first launch and normalization fallbacks.
 */
export const DEFAULT_COLLECTION_RUNNER_CONFIG = {
    delayMs: 0,
    stopOnFailure: false,
    environmentMode: 'active',
    environmentId: null
};
/**
 * Counts passed, failed, and skipped rows from a result list.
 *
 * @param results - Runner result rows, typically from a completed or imported run.
 * @returns Summary counts for progress display and import hydration.
 */
export function summarizeRunnerResults(results) {
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    for (const result of results) {
        if (result.status === 'passed') {
            passed += 1;
        }
        else if (result.status === 'failed') {
            failed += 1;
        }
        else if (result.status === 'skipped') {
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
export function buildRunResultsExport(args) {
    const isRequestRun = args.requestId != null;
    const exportKind = isRequestRun
        ? 'request-run-results'
        : 'collection-run-results';
    const payload = {
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
export function buildSavedRunLabel(payload) {
    const target = payload.request?.name ?? payload.collection?.folderName ?? payload.collection?.name ?? 'Run';
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    return `${target} — ${timestamp}`;
}
/**
 * Returns the HTTP method of the first request in a saved run result payload.
 *
 * @param payload - Portable run-results export body.
 * @returns Method of the first result row, or the single-request export method when present.
 */
export function firstRunResultMethod(payload) {
    return payload.results[0]?.requestMethod ?? payload.request?.method ?? null;
}
/**
 * Derives list metadata from a run-results export payload.
 *
 * @param payload - Portable export body being saved.
 * @returns Kind, names, and summary counts for persistence and list views.
 */
export function extractSavedRunMetadata(payload) {
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
export function resolveImportedRunnerTargetIds(data, collections, requestsByCollection) {
    let collectionId = 0;
    if (data.collection?.uuid) {
        const collection = collections.find((item) => item.uuid === data.collection?.uuid);
        if (collection) {
            collectionId = collection.id;
        }
    }
    let requestId = null;
    if (data.request?.uuid) {
        const searchCollectionIds = collectionId > 0 ? [collectionId] : Object.keys(requestsByCollection).map(Number);
        for (const id of searchCollectionIds) {
            const match = (requestsByCollection[id] ?? []).find((request) => request.uuid === data.request?.uuid);
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
export function normalizeCollectionRunnerConfig(input) {
    const delayMs = Number(input?.delayMs ?? DEFAULT_COLLECTION_RUNNER_CONFIG.delayMs);
    const environmentMode = input?.environmentMode === 'override'
        ? 'override'
        : DEFAULT_COLLECTION_RUNNER_CONFIG.environmentMode;
    const environmentCandidate = input?.environmentId == null ? null : Number(input.environmentId);
    const environmentId = environmentMode === 'override' &&
        Number.isInteger(environmentCandidate) &&
        environmentCandidate > 0
        ? environmentCandidate
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
export function getRequestsInRunOrder(collectionId, folderId, requests, folders) {
    const collectionRequests = requests.filter((request) => request.collection_id === collectionId);
    const sortRequests = (items) => [...items].sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name));
    if (folderId != null) {
        return sortRequests(collectionRequests.filter((request) => request.folder_id === folderId));
    }
    const rootRequests = sortRequests(collectionRequests.filter((request) => request.folder_id == null));
    const sortedFolders = [...folders]
        .filter((folder) => folder.collection_id === collectionId)
        .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name));
    const nestedRequests = sortedFolders.flatMap((folder) => sortRequests(collectionRequests.filter((request) => request.folder_id === folder.id)));
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
export function getCollectionRunnerRequests(collectionId, folderId, requestId, requests, folders) {
    if (requestId != null) {
        const match = requests.find((request) => request.collection_id === collectionId && request.id === requestId);
        return match ? [match] : [];
    }
    return getRequestsInRunOrder(collectionId, folderId, requests, folders);
}
/**
 * Returns saved requests for an explicit id list, preserving caller order.
 *
 * @param requestIds - Request database ids in the desired run order.
 * @param requestsByCollection - Cached requests keyed by collection id.
 * @returns Matching saved requests, omitting ids that no longer exist.
 */
export function getRequestsByIds(requestIds, requestsByCollection) {
    const byId = new Map();
    for (const requests of Object.values(requestsByCollection)) {
        for (const request of requests) {
            byId.set(request.id, request);
        }
    }
    const ordered = [];
    for (const requestId of requestIds) {
        const match = byId.get(requestId);
        if (match) {
            ordered.push(match);
        }
    }
    return ordered;
}
/**
 * Returns test pass/fail counts for a script test result list.
 *
 * @param testResults - hc.test results from the last send.
 * @returns Counts of passing and failing assertions.
 */
export function countTestResults(testResults) {
    let testsPassed = 0;
    let testsFailed = 0;
    for (const test of testResults) {
        if (test.passed) {
            testsPassed += 1;
        }
        else {
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
export function isCollectionRunnerRequestFailure(response, testResults) {
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
export function buildPendingCollectionRunnerResults(requests) {
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
export function resolveCollectionRunnerNextIndex(orderedRequests, currentIndex, nextRequest) {
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
//# sourceMappingURL=collectionRunner.js.map