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
 * Reloads all snippets from the local registry database.
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
  { name: string; code: string; scope: SnippetScope },
  ThunkApiConfig
>('snippets/create', async ({ name, code, scope }, { dispatch }) => {
  const snippet = await window.api.createSnippet(name, code, scope);
  await dispatch(refreshSnippets());
  return snippet;
});

/**
 * Updates a snippet and refreshes the snippets list.
 */
export const updateSnippet = createAsyncThunk<
  Snippet,
  { id: number; name: string; code: string; scope: SnippetScope },
  ThunkApiConfig
>('snippets/update', async ({ id, name, code, scope }, { dispatch }) => {
  const snippet = await window.api.updateSnippet(id, name, code, scope);
  await dispatch(refreshSnippets());
  return snippet;
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
