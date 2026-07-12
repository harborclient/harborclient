import { createAsyncThunk } from '@reduxjs/toolkit';
import type { CollectionExportResult, Environment, Variable } from '#/shared/types';
import { mergeEnvironmentVariables } from '#/shared/environmentVariables';
import {
  reorderEnvironmentsLocal,
  setActiveEnvironmentId,
  setEnvironments
} from '#/renderer/src/store/slices/environmentsSlice';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import { syncTrash } from '#/renderer/src/store/thunks/trash';
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
    await syncTrash(dispatch);
  }
);

/**
 * Deep-copies an environment and places the duplicate directly below the original.
 */
export const duplicateEnvironment = createAsyncThunk<Environment, number, ThunkApiConfig>(
  'environments/duplicate',
  async (id, { dispatch, getState }) => {
    const environment = await window.api.duplicateEnvironment(id);
    await dispatch(refreshEnvironments());

    const environments = getState().environments.environments;
    const sourceIndex = environments.findIndex((item) => item.id === id);
    if (sourceIndex >= 0) {
      const orderedIds = environments.map((item) => item.id);
      orderedIds.splice(sourceIndex + 1, 0, environment.id);
      const dedupedIds = orderedIds.filter(
        (environmentId, index) => orderedIds.indexOf(environmentId) === index
      );
      await dispatch(reorderEnvironments({ orderedEnvironmentIds: dedupedIds }));
    }

    dispatch(setActiveEnvironmentId(environment.id));
    return environment;
  }
);

/**
 * Persists a new sidebar order for environments.
 */
export const reorderEnvironments = createAsyncThunk<
  void,
  { orderedEnvironmentIds: number[] },
  ThunkApiConfig
>('environments/reorderEnvironments', async ({ orderedEnvironmentIds }, { dispatch }) => {
  dispatch(reorderEnvironmentsLocal({ orderedEnvironmentIds }));
  await window.api.reorderEnvironments(orderedEnvironmentIds);
  await dispatch(refreshEnvironments());
});

/**
 * Merges an environment into the one directly below it in sidebar order.
 *
 * The bottom environment survives with the top environment's name and merged
 * variables; the top environment is deleted afterward.
 */
export const mergeEnvironmentDown = createAsyncThunk<void, number, ThunkApiConfig>(
  'environments/mergeDown',
  async (topEnvironmentId, { dispatch, getState }) => {
    const { environments, activeEnvironmentId } = getState().environments;
    const index = environments.findIndex((environment) => environment.id === topEnvironmentId);
    if (index < 0 || index >= environments.length - 1) {
      throw new Error('Cannot merge down: no environment below the selected one.');
    }

    const top = environments[index];
    const bottom = environments[index + 1];
    const mergedVariables = mergeEnvironmentVariables(bottom.variables, top.variables);

    await window.api.updateEnvironment(bottom.id, top.name, mergedVariables);
    if (activeEnvironmentId === top.id) {
      dispatch(setActiveEnvironmentId(bottom.id));
    }
    await window.api.deleteEnvironment(top.id);
    await dispatch(refreshEnvironments());
  }
);

/**
 * Exports an environment to a user-chosen file path.
 */
export const exportEnvironment = createAsyncThunk<CollectionExportResult, number, ThunkApiConfig>(
  'environments/export',
  async (id) => {
    return window.api.exportEnvironment(id);
  }
);

/**
 * Imports an environment from disk and refreshes sidebar state.
 */
export const importEnvironment = createAsyncThunk<Environment | null, void, ThunkApiConfig>(
  'environments/import',
  async (_, { dispatch }) => {
    const environment = await window.api.importEnvironment();
    if (!environment) return null;

    await dispatch(refreshEnvironments());
    dispatch(setActiveEnvironmentId(environment.id));
    return environment;
  }
);
