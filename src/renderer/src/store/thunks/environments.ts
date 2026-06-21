import { createAsyncThunk } from '@reduxjs/toolkit';
import type { Environment, Variable } from '#/shared/types';
import {
  setActiveEnvironmentId,
  setEnvironments
} from '#/renderer/src/store/slices/environmentsSlice';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import {
  beginRefreshGeneration,
  isLatestRefreshGeneration
} from '#/renderer/src/store/refreshGeneration';

const ENVIRONMENTS_REFRESH_KEY = 'environments';

/**
 * Reloads all environments and clears the active selection when it no longer exists.
 */
export const refreshEnvironments = createAsyncThunk<
  Awaited<ReturnType<typeof window.api.listEnvironments>>,
  void,
  ThunkApiConfig
>('environments/refresh', async (_, { dispatch, getState }) => {
  const generation = beginRefreshGeneration(ENVIRONMENTS_REFRESH_KEY);
  const data = await window.api.listEnvironments();
  if (!isLatestRefreshGeneration(ENVIRONMENTS_REFRESH_KEY, generation)) {
    return getState().environments.environments;
  }
  dispatch(setEnvironments(data));
  const activeId = getState().environments.activeEnvironmentId;
  if (activeId != null && !data.some((env) => env.id === activeId)) {
    dispatch(setActiveEnvironmentId(null));
  }
  return data;
});

/**
 * Creates an environment and makes it the active selection.
 */
export const createEnvironment = createAsyncThunk<Environment, string, ThunkApiConfig>(
  'environments/create',
  async (name, { dispatch }) => {
    const environment = await window.api.createEnvironment(name);
    await dispatch(refreshEnvironments());
    dispatch(setActiveEnvironmentId(environment.id));
    return environment;
  }
);

/**
 * Updates environment metadata and refreshes the environment list.
 */
export const updateEnvironment = createAsyncThunk<
  void,
  { id: number; name: string; variables: Variable[] },
  ThunkApiConfig
>('environments/update', async ({ id, name, variables }, { dispatch }) => {
  await window.api.updateEnvironment(id, name, variables);
  await dispatch(refreshEnvironments());
});

/**
 * Deletes an environment and clears the active selection when it was selected.
 */
export const deleteEnvironment = createAsyncThunk<void, number, ThunkApiConfig>(
  'environments/delete',
  async (id, { dispatch, getState }) => {
    await window.api.deleteEnvironment(id);
    if (getState().environments.activeEnvironmentId === id) {
      dispatch(setActiveEnvironmentId(null));
    }
    await dispatch(refreshEnvironments());
  }
);
