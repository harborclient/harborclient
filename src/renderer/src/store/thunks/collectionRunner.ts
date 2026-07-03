import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import {
  buildPendingCollectionRunnerResults,
  countTestResults,
  getCollectionRunnerRequests,
  isCollectionRunnerRequestFailure,
  normalizeCollectionRunnerConfig,
  type CollectionRunnerConfig
} from '#/shared/collectionRunner';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import type { RootState } from '#/renderer/src/store/redux';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import {
  appendCollectionRunnerResult,
  finishCollectionRunner,
  selectCollectionRunnerModal,
  setCollectionRunnerRequestRunning,
  skipRemainingCollectionRunnerRequests,
  startCollectionRunner
} from '#/renderer/src/store/slices/modalsSlice';
import {
  selectFoldersByCollection,
  selectRequestsByCollection,
  selectResponse,
  selectTestResults
} from '#/renderer/src/store/selectors';
import { refreshCollectionContents } from '#/renderer/src/store/thunks/collections';
import { requestLoadRequest, sendRequest } from '#/renderer/src/store/thunks/requests';

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
 * Returns true when the collection runner modal has been cancelled.
 *
 * @param state - Current Redux state.
 */
function isCollectionRunnerCancelled(state: RootState): boolean {
  return Boolean(selectCollectionRunnerModal(state)?.cancelled);
}

/**
 * Runs saved requests in sidebar order for the open collection runner target.
 */
export const runCollectionRequests = createAsyncThunk<void, void, ThunkApiConfig>(
  'collectionRunner/run',
  async (_, { dispatch, getState }) => {
    const runner = selectCollectionRunnerModal(getState());
    if (!runner || runner.phase !== 'configure') {
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

    await window.api.setCollectionRunnerConfig(config);

    const previousEnvironmentId = state.environments.activeEnvironmentId;
    if (config.environmentMode === 'override') {
      dispatch(setActiveEnvironmentId(config.environmentId));
    }

    try {
      for (let index = 0; index < orderedRequests.length; index += 1) {
        if (isCollectionRunnerCancelled(getState())) {
          dispatch(skipRemainingCollectionRunnerRequests());
          break;
        }

        const request = orderedRequests[index];
        dispatch(setCollectionRunnerRequestRunning(request.id));

        await dispatch(
          requestLoadRequest({ req: request, skipSettingsCheck: true, forceReload: true })
        ).unwrap();

        if (isCollectionRunnerCancelled(getState())) {
          dispatch(skipRemainingCollectionRunnerRequests());
          break;
        }

        await dispatch(sendRequest()).unwrap();

        const response = selectResponse(getState());
        const testResults = selectTestResults(getState());
        const { testsPassed, testsFailed } = countTestResults(testResults);
        const failed = isCollectionRunnerRequestFailure(response, testResults);

        dispatch(
          appendCollectionRunnerResult({
            requestId: request.id,
            status: failed ? 'failed' : 'passed',
            httpStatus: response?.status,
            httpError: response?.error,
            testsPassed,
            testsFailed
          })
        );

        if (config.stopOnFailure && failed) {
          dispatch(skipRemainingCollectionRunnerRequests());
          break;
        }

        if (config.delayMs > 0 && index < orderedRequests.length - 1) {
          await sleep(config.delayMs);
        }
      }
    } finally {
      if (config.environmentMode === 'override') {
        dispatch(setActiveEnvironmentId(previousEnvironmentId));
      }
      dispatch(finishCollectionRunner());

      const summary = selectCollectionRunnerModal(getState())?.summary;
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
