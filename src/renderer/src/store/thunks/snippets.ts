import { createAsyncThunk } from '@reduxjs/toolkit';
import type { Snippet } from '#/shared/types';
import type { SnippetScope } from '#/shared/snippetScope';
import { setSnippets } from '#/renderer/src/store/slices/snippetsSlice';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import {
  beginRefreshGeneration,
  isLatestRefreshGeneration
} from '#/renderer/src/store/refreshGeneration';

const SNIPPETS_REFRESH_KEY = 'snippets';

/**
 * Reloads all routed and marketplace snippets from the main process.
 */
export const refreshSnippets = createAsyncThunk<
  Awaited<ReturnType<typeof window.api.listSnippets>>,
  void,
  ThunkApiConfig
>('snippets/refresh', async (_, { dispatch, getState }) => {
  const generation = beginRefreshGeneration(SNIPPETS_REFRESH_KEY);
  const data = await window.api.listSnippets();
  if (!isLatestRefreshGeneration(SNIPPETS_REFRESH_KEY, generation)) {
    return getState().snippets.snippets;
  }
  dispatch(setSnippets(data));
  return data;
});

/**
 * Creates a snippet and refreshes the snippets list.
 */
export const createSnippet = createAsyncThunk<
  Snippet,
  { name: string; code: string; scope: SnippetScope; connectionId?: string },
  ThunkApiConfig
>('snippets/create', async ({ name, code, scope, connectionId }, { dispatch }) => {
  const snippet = await window.api.createSnippet(name, code, scope, connectionId);
  await dispatch(refreshSnippets());
  return snippet;
});

/**
 * Updates a snippet, moving it first when the storage location changed.
 */
export const updateSnippet = createAsyncThunk<
  Snippet,
  {
    id: number;
    name: string;
    code: string;
    scope: SnippetScope;
    connectionId?: string;
  },
  ThunkApiConfig
>('snippets/update', async ({ id, name, code, scope, connectionId }, { dispatch, getState }) => {
  const state = getState();
  const snippet = state.snippets.snippets.find((item) => item.id === id);
  const primaryConnectionId = await window.api.getActiveStorageId();
  const currentConnectionId = snippet?.connectionId ?? primaryConnectionId;

  if (connectionId && connectionId !== currentConnectionId) {
    await window.api.moveSnippet(id, connectionId);

    let updated: Snippet;
    try {
      updated = await window.api.updateSnippet(id, name, code, scope);
    } catch (err) {
      await dispatch(refreshSnippets());
      throw new Error(
        'Snippet was moved to the new database, but your changes could not be saved. Open the snippet again and save.',
        { cause: err }
      );
    }

    await dispatch(refreshSnippets());
    return updated;
  }

  const updated = await window.api.updateSnippet(id, name, code, scope);
  await dispatch(refreshSnippets());
  return updated;
});

/**
 * Deletes a snippet and refreshes the snippets list.
 */
export const deleteSnippet = createAsyncThunk<void, number, ThunkApiConfig>(
  'snippets/delete',
  async (id, { dispatch }) => {
    await window.api.deleteSnippet(id);
    await dispatch(refreshSnippets());
  }
);
