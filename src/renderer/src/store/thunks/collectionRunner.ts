import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import {
  buildPendingCollectionRunnerResults,
  countTestResults,
  getCollectionRunnerRequests,
  isCollectionRunnerRequestFailure,
  normalizeCollectionRunnerConfig,
  resolveCollectionRunnerNextIndex,
  type CollectionRunnerConfig
} from '#/shared/collectionRunner';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import type { RootState } from '#/renderer/src/store/redux';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import {
  appendCollectionRunnerResult,
  finishCollectionRunner,
  selectCollectionRunner,
  setCollectionRunnerRequestRunning,
  skipRemainingCollectionRunnerRequests,
  startCollectionRunner
} from '#/renderer/src/store/slices/modalsSlice';
import { draftFromSaved } from '#/renderer/src/store/drafts';
import {
  selectCollections,
  selectFoldersByCollection,
  selectRequestsByCollection
} from '#/renderer/src/store/selectors';
import { refreshCollectionContents } from '#/renderer/src/store/thunks/collections';
import { executeRequestDraft } from '#/renderer/src/store/thunks/requests';
import { recordRequestHistoryRun } from '#/renderer/src/store/thunks/requestHistory';
import {
  resolveRunnerTargetNames,
  runnerTargetLabel
} from '#/renderer/src/ui/CollectionRunner/resolveRunnerTargetName';

/**
 * Waits for the configured delay between collection runner requests.
 *
 * @param delayMs - Milliseconds to pause before the next request.
 */
function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

/**
 * Returns true when the collection runner has been cancelled or closed.
 *
 * @param state - Current Redux state.
 */
function isCollectionRunnerCancelled(state: RootState): boolean {
  const runner = selectCollectionRunner(state);
  return runner == null || runner.cancelled;
}

/**
 * Runs saved requests in sidebar order for the open collection runner target.
 */
export const runCollectionRequests = createAsyncThunk<void, void, ThunkApiConfig>(
  'collectionRunner/run',
  async (_, { dispatch, getState }) => {
    const runner = selectCollectionRunner(getState());
    if (!runner || (runner.phase !== 'configure' && runner.phase !== 'complete')) {
      return;
    }

    const { collectionId, folderId, requestId } = runner;
    let state = getState();
    let requests = selectRequestsByCollection(state)[collectionId];
    let folders = selectFoldersByCollection(state)[collectionId];

    if (!requests?.length) {
      await dispatch(refreshCollectionContents(collectionId)).unwrap();
      state = getState();
      requests = selectRequestsByCollection(state)[collectionId] ?? [];
      folders = selectFoldersByCollection(state)[collectionId] ?? [];
    }

    const orderedRequests = getCollectionRunnerRequests(
      collectionId,
      folderId,
      requestId,
      requests ?? [],
      folders ?? []
    );

    if (orderedRequests.length === 0) {
      return;
    }

    const config: CollectionRunnerConfig = normalizeCollectionRunnerConfig({
      delayMs: runner.delayMs,
      stopOnFailure: runner.stopOnFailure,
      environmentMode: runner.environmentMode,
      environmentId: runner.environmentId
    });

    dispatch(
      startCollectionRunner({ results: buildPendingCollectionRunnerResults(orderedRequests) })
    );

    const targetNames = resolveRunnerTargetNames(
      { collectionId, folderId, requestId },
      selectCollections(state),
      folders ?? [],
      requests ?? []
    );
    void dispatch(
      recordRequestHistoryRun({
        method: orderedRequests[0].method,
        name: runnerTargetLabel(targetNames),
        collectionId,
        folderId: folderId ?? null,
        requestId: requestId ?? null
      })
    );

    await window.api.setCollectionRunnerConfig(config);

    const previousEnvironmentId = state.environments.activeEnvironmentId;
    if (config.environmentMode === 'override') {
      dispatch(setActiveEnvironmentId(config.environmentId));
    }

    const maxSteps = Math.max(orderedRequests.length * 10, orderedRequests.length);
    let steps = 0;
    let index = 0;

    try {
      while (index >= 0 && index < orderedRequests.length) {
        steps += 1;
        if (steps > maxSteps) {
          break;
        }

        if (isCollectionRunnerCancelled(getState())) {
          dispatch(skipRemainingCollectionRunnerRequests());
          break;
        }

        const request = orderedRequests[index];
        dispatch(setCollectionRunnerRequestRunning(request.id));

        if (isCollectionRunnerCancelled(getState())) {
          dispatch(skipRemainingCollectionRunnerRequests());
          break;
        }

        const draft = draftFromSaved(request);
        const requestId = crypto.randomUUID();
        const outcome = await executeRequestDraft(
          { draft, requestId, recordHistory: false },
          { dispatch, getState }
        );

        const response = outcome.response;
        const testResults = outcome.testResults;
        const scriptSkipRequest = outcome.scriptSkipRequest;
        const scriptNextRequest = outcome.scriptNextRequest;
        const { testsPassed, testsFailed } = countTestResults(testResults);
        const failed =
          !scriptSkipRequest && isCollectionRunnerRequestFailure(response, testResults);

        dispatch(
          appendCollectionRunnerResult({
            requestId: request.id,
            status: scriptSkipRequest ? 'skipped' : failed ? 'failed' : 'passed',
            httpStatus: response?.status,
            httpError: response?.error,
            testsPassed,
            testsFailed,
            response,
            testResults,
            scriptLogs: outcome.scriptLogs,
            executionEvents: outcome.executionEvents,
            scriptError: outcome.scriptError,
            requestUrl: draft.url
          })
        );

        if (config.stopOnFailure && failed) {
          dispatch(skipRemainingCollectionRunnerRequests());
          break;
        }

        const nextIndex = resolveCollectionRunnerNextIndex(
          orderedRequests,
          index,
          scriptNextRequest
        );
        if (nextIndex === null) {
          break;
        }

        if (config.delayMs > 0 && nextIndex !== index) {
          await sleep(config.delayMs);
        }

        index = nextIndex;
      }
    } finally {
      if (config.environmentMode === 'override') {
        dispatch(setActiveEnvironmentId(previousEnvironmentId));
      }
      dispatch(finishCollectionRunner());

      const summary = selectCollectionRunner(getState())?.summary;
      if (summary) {
        toast.success(
          `Run complete: ${summary.passed} passed, ${summary.failed} failed${
            summary.skipped > 0 ? `, ${summary.skipped} skipped` : ''
          }`
        );
      }
    }
  }
);
