import { createAsyncThunk } from '@reduxjs/toolkit';
import type { WorkflowRunHistoryEntry } from '@harborclient/core/types/workflowRunHistory';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import {
  clearWorkflowRunHistoryState,
  setWorkflowRunHistory
} from '#/renderer/src/store/slices/workflowRunHistorySlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  getWorkflowRunExport,
  getWorkflowRunLog,
  getWorkflowRunLogMeta,
  loadWorkflowRunLogFromHistory
} from '#/renderer/src/workflows/workflowRunLog';

/**
 * Reloads persisted workflow run history from the local registry into the store.
 */
export const refreshWorkflowRunHistory = createAsyncThunk<void, void, ThunkApiConfig>(
  'workflowRunHistory/refresh',
  async (_arg, { dispatch }) => {
    const items = await window.api.listWorkflowRunHistory();
    dispatch(setWorkflowRunHistory(items));
  }
);

/**
 * Persists a completed workflow run and updates the cached history list.
 *
 * @param entry - Run metadata and payload to store (id assigned by the database).
 */
export const recordWorkflowRunHistory = createAsyncThunk<
  void,
  Omit<WorkflowRunHistoryEntry, 'id'> & { id?: number },
  ThunkApiConfig
>('workflowRunHistory/record', async (entry, { dispatch }) => {
  const items = await window.api.addWorkflowRunHistory(entry);
  dispatch(setWorkflowRunHistory(items));
});

/**
 * Records the current in-memory workflow run log into local history when available.
 *
 * No-ops when the run log has no metadata or steps.
 */
export const recordCurrentWorkflowRunHistory = createAsyncThunk<void, void, ThunkApiConfig>(
  'workflowRunHistory/recordCurrent',
  async (_arg, { dispatch }) => {
    const meta = getWorkflowRunLogMeta();
    const envelope = getWorkflowRunExport();
    const logEntries = getWorkflowRunLog();
    if (meta == null || envelope == null || logEntries.length === 0) {
      return;
    }

    await dispatch(
      recordWorkflowRunHistory({
        workflowUuid: meta.workflowUuid,
        name: meta.name,
        environment: meta.environment,
        dateCreated: meta.date_created,
        ts: Date.now(),
        payload: {
          export: envelope,
          steps: logEntries.map((entry) => ({
            action: entry.action,
            result: entry.result,
            ranAt: entry.ranAt,
            durationMs: entry.durationMs
          }))
        }
      })
    );
  }
);

/**
 * Removes all persisted workflow run history entries.
 */
export const clearWorkflowRunHistory = createAsyncThunk<void, void, ThunkApiConfig>(
  'workflowRunHistory/clear',
  async (_arg, { dispatch }) => {
    await window.api.clearWorkflowRunHistory();
    dispatch(clearWorkflowRunHistoryState());
  }
);

/**
 * Removes one persisted workflow run history entry by id.
 */
export const deleteWorkflowRunHistory = createAsyncThunk<void, number, ThunkApiConfig>(
  'workflowRunHistory/delete',
  async (id, { dispatch }) => {
    const items = await window.api.deleteWorkflowRunHistory(id);
    dispatch(setWorkflowRunHistory(items));
  }
);

/**
 * Hydrates the in-memory run log from a history entry and opens the results page.
 */
export const openWorkflowRunHistory = createAsyncThunk<
  void,
  WorkflowRunHistoryEntry,
  ThunkApiConfig
>('workflowRunHistory/open', async (entry, { dispatch }) => {
  loadWorkflowRunLogFromHistory({
    workflowUuid: entry.workflowUuid,
    name: entry.name,
    environment: entry.environment,
    date_created: entry.dateCreated,
    steps: entry.payload.steps
  });
  dispatch(
    openPageTab({
      type: 'workflow-run-results',
      workflowUuid: entry.workflowUuid
    })
  );
});
