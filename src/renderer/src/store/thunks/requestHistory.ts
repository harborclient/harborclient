import { createAsyncThunk } from '@reduxjs/toolkit';
import type { SendRequestInput } from '#/shared/types';
import type { SendResult } from '@harborclient/http';
import type { RequestHistoryEntry } from '#/shared/types/requestHistory';
import type { BodyType } from '#/shared/types/common';
import { toPluginHttpRequest } from '#/shared/plugin/httpRequest';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import { syncTrash } from '#/renderer/src/store/thunks/trash';
import {
  clearRequestHistoryState,
  setRequestHistory
} from '#/renderer/src/store/slices/requestHistorySlice';
import { openCollectionRunner } from '#/renderer/src/store/slices/modalsSlice';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  selectCollections,
  selectFoldersByCollection,
  selectRequestsByCollection
} from '#/renderer/src/store/selectors';
import { resolveRunnerTargetNames } from '#/renderer/src/ui/CollectionRunner/resolveRunnerTargetName';

/** Sequence counter disambiguating ids captured within the same millisecond. */
let entrySequence = 0;

/**
 * Returns a capture id that stays unique within the renderer session.
 *
 * @returns Numeric id combining epoch milliseconds and a per-ms sequence.
 */
export function nextRequestHistoryEntryId(): number {
  entrySequence += 1;
  return Date.now() * 1000 + (entrySequence % 1000);
}

/**
 * Fills in defaults for entries persisted before capture metadata was expanded.
 *
 * @param entry - Stored or session history entry.
 * @returns Entry safe to render and reopen in the editor.
 */
export function normalizeRequestHistoryEntry(entry: RequestHistoryEntry): RequestHistoryEntry {
  const isRun = entry.kind === 'run';

  return {
    ...entry,
    name: entry.name?.trim() || (isRun ? 'Run' : entry.url),
    headers: entry.headers ?? {},
    params: entry.params ?? [],
    body: entry.body ?? ''
  };
}

/**
 * Builds a request history entry from a completed send.
 *
 * @param sendInput - Outgoing request metadata captured at send time.
 * @param result - Completed HTTP response metadata.
 * @returns Normalized entry ready for persistence.
 */
export function buildRequestHistoryEntry(
  sendInput: SendRequestInput,
  result: SendResult
): RequestHistoryEntry {
  const pluginRequest = toPluginHttpRequest(sendInput);

  return normalizeRequestHistoryEntry({
    id: nextRequestHistoryEntryId(),
    method: pluginRequest.method,
    url: pluginRequest.url,
    status: result.status,
    statusText: result.statusText,
    ts: Date.now(),
    savedRequestId: pluginRequest.sourceRequestId,
    name: pluginRequest.sourceRequestName?.trim() || pluginRequest.url,
    headers: pluginRequest.headers,
    params: pluginRequest.params,
    body: pluginRequest.body,
    bodyType: pluginRequest.bodyType as BodyType | undefined
  });
}

/**
 * Reloads persisted request history from the local registry into the store.
 */
export const refreshRequestHistory = createAsyncThunk<void, void, ThunkApiConfig>(
  'requestHistory/refresh',
  async (_arg, { dispatch }) => {
    const items = await window.api.listRequestHistory();
    dispatch(setRequestHistory(items.map(normalizeRequestHistoryEntry)));
  }
);

/**
 * Persists a completed request and updates the cached history list.
 */
export const recordRequestHistory = createAsyncThunk<void, RequestHistoryEntry, ThunkApiConfig>(
  'requestHistory/record',
  async (entry, { dispatch }) => {
    const items = await window.api.addRequestHistory(normalizeRequestHistoryEntry(entry));
    dispatch(setRequestHistory(items.map(normalizeRequestHistoryEntry)));
  }
);

/**
 * Records a completed send in request history.
 */
export const recordRequestHistoryFromSend = createAsyncThunk<
  void,
  { sendInput: SendRequestInput; result: SendResult },
  ThunkApiConfig
>('requestHistory/recordFromSend', async ({ sendInput, result }, { dispatch }) => {
  if (result.error) {
    return;
  }

  await dispatch(recordRequestHistory(buildRequestHistoryEntry(sendInput, result)));
});

/**
 * Removes all persisted request history entries and clears the cached list.
 */
export const clearRequestHistory = createAsyncThunk<void, void, ThunkApiConfig>(
  'requestHistory/clear',
  async (_arg, { dispatch }) => {
    await window.api.clearRequestHistory();
    dispatch(clearRequestHistoryState());
  }
);

/**
 * Removes one persisted request history entry and updates the cached list.
 */
export const deleteRequestHistory = createAsyncThunk<void, number, ThunkApiConfig>(
  'requestHistory/delete',
  async (id, { dispatch }) => {
    const items = await window.api.deleteRequestHistory(id);
    dispatch(setRequestHistory(items.map(normalizeRequestHistoryEntry)));
    await syncTrash(dispatch);
  }
);

/**
 * Records a collection runner run as a single history entry.
 */
export const recordRequestHistoryRun = createAsyncThunk<
  void,
  {
    method: string;
    name: string;
    collectionId: number;
    folderId?: number | null;
    requestId?: number | null;
  },
  ThunkApiConfig
>('requestHistory/recordRun', async (args, { dispatch }) => {
  await dispatch(
    recordRequestHistory(
      normalizeRequestHistoryEntry({
        id: nextRequestHistoryEntryId(),
        kind: 'run',
        method: args.method,
        url: '',
        status: 0,
        statusText: '',
        ts: Date.now(),
        name: args.name,
        runCollectionId: args.collectionId,
        runFolderId: args.folderId ?? null,
        runRequestId: args.requestId ?? null
      })
    )
  );
});

/**
 * Opens a run history entry in the collection runner tab.
 */
export const openRequestHistoryRun = createAsyncThunk<void, RequestHistoryEntry, ThunkApiConfig>(
  'requestHistory/openRun',
  async (entry, { dispatch, getState }) => {
    const normalized = normalizeRequestHistoryEntry(entry);
    if (normalized.kind !== 'run' || normalized.runCollectionId == null) {
      return;
    }

    const state = getState();
    const collectionId = normalized.runCollectionId;
    const folderId = normalized.runFolderId ?? null;
    const requestId = normalized.runRequestId ?? null;
    const names = resolveRunnerTargetNames(
      { collectionId, folderId, requestId },
      selectCollections(state),
      selectFoldersByCollection(state)[collectionId] ?? [],
      selectRequestsByCollection(state)[collectionId] ?? []
    );

    dispatch(
      openCollectionRunner({
        collectionId,
        folderId,
        collectionName: names.collectionName,
        folderName: names.folderName,
        requestId,
        requestName: names.requestName
      })
    );
    dispatch(
      openPageTab({
        type: 'collection-runner',
        collectionId,
        folderId,
        requestId: requestId ?? undefined
      })
    );
  }
);
