import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import { buildWorkflowExport } from '@harborclient/core/types/workflow';
import type { WorkflowAction } from '@harborclient/core/types';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import {
  closeWorkflowDialog,
  setWorkflowSaveError,
  setWorkflowSaveNameModalOpen,
  setWorkflowSaving,
  setWorkflows
} from '#/renderer/src/store/slices/workflowsSlice';
import { syncTrash } from '#/renderer/src/store/thunks/trash';
import { formatErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';
import {
  clearSession,
  getRecordingElapsedMs,
  getSessionEvents,
  stopRecording
} from '#/renderer/src/workflows/workflowRecorder';
import { sanitizeWorkflowActions } from '#/renderer/src/workflows/sanitizeWorkflowActions';
import { emitPluginWorkflowsChanged } from '#/renderer/src/plugins/pluginWorkflowsChangedBus';

/**
 * Reloads workflows from the local registry into the store.
 */
export const refreshWorkflows = createAsyncThunk<void, void, ThunkApiConfig>(
  'workflows/refresh',
  async (_arg, { dispatch }) => {
    const items = await window.api.listWorkflows();
    dispatch(setWorkflows(items));
    emitPluginWorkflowsChanged({ reason: 'refreshed' });
  }
);

/**
 * Persists the current recording session under the given name.
 */
export const createWorkflowFromSession = createAsyncThunk<void, string, ThunkApiConfig>(
  'workflows/createFromSession',
  async (name, { dispatch }) => {
    const trimmed = name.trim();
    if (!trimmed) {
      dispatch(setWorkflowSaveError('Workflow name is required'));
      return;
    }

    dispatch(setWorkflowSaving(true));
    dispatch(setWorkflowSaveError(null));
    try {
      stopRecording();
      const actions = sanitizeWorkflowActions(getSessionEvents());
      if (actions.length === 0) {
        dispatch(setWorkflowSaveError('Record at least one action before saving'));
        return;
      }

      const uuid = crypto.randomUUID();
      const durationMs = getRecordingElapsedMs();
      const items = await window.api.createWorkflow({
        name: trimmed,
        uuid,
        durationMs,
        variables: {},
        actions
      });
      dispatch(setWorkflows(items));
      const created = items.find((item) => item.uuid === uuid);
      emitPluginWorkflowsChanged({
        reason: 'created',
        ...(created != null ? { workflowId: created.id } : {})
      });
      clearSession();
      dispatch(setWorkflowSaveNameModalOpen(false));
      dispatch(closeWorkflowDialog());
      toast.success('Workflow saved');
    } catch (error) {
      dispatch(setWorkflowSaveError(formatErrorMessage(error, 'Failed to save workflow')));
      throw error;
    } finally {
      dispatch(setWorkflowSaving(false));
    }
  }
);

/**
 * Renames a workflow and refreshes the list.
 */
export const renameWorkflow = createAsyncThunk<void, { id: number; name: string }, ThunkApiConfig>(
  'workflows/rename',
  async ({ id, name }, { dispatch }) => {
    const items = await window.api.renameWorkflow(id, name.trim());
    dispatch(setWorkflows(items));
    emitPluginWorkflowsChanged({ reason: 'renamed', workflowId: id });
  }
);

/**
 * Moves a workflow to trash and refreshes the list.
 */
export const deleteWorkflow = createAsyncThunk<void, number, ThunkApiConfig>(
  'workflows/delete',
  async (id, { dispatch }) => {
    const items = await window.api.deleteWorkflow(id);
    dispatch(setWorkflows(items));
    emitPluginWorkflowsChanged({ reason: 'deleted', workflowId: id });
    await syncTrash(dispatch);
  }
);

/**
 * Persists edited workflow actions and refreshes the list.
 */
export const updateWorkflowActions = createAsyncThunk<
  void,
  { id: number; actions: WorkflowAction[]; durationMs: number },
  ThunkApiConfig
>('workflows/updateActions', async ({ id, actions, durationMs }, { dispatch }) => {
  const sanitized = sanitizeWorkflowActions(actions);
  const nextDurationMs = sanitized.length === 0 ? 0 : durationMs;
  const items = await window.api.updateWorkflow({
    id,
    actions: sanitized,
    durationMs: nextDurationMs
  });
  dispatch(setWorkflows(items));
  emitPluginWorkflowsChanged({ reason: 'updated', workflowId: id });
  toast.success('Workflow updated');
});

/**
 * Exports a workflow as a HarborClient JSON file via the save dialog.
 */
export const exportWorkflow = createAsyncThunk<void, number, ThunkApiConfig>(
  'workflows/export',
  async (id, { getState }) => {
    const workflow = getState().workflows.items.find((item) => item.id === id);
    if (!workflow) {
      toast.error('Workflow not found');
      return;
    }

    const envelope = buildWorkflowExport({
      uuid: workflow.uuid,
      name: workflow.name,
      variables: workflow.variables,
      actions: sanitizeWorkflowActions(workflow.actions),
      durationMs: workflow.durationMs
    });
    const saved = await window.api.saveTextFile(
      JSON.stringify(envelope, null, 2),
      `${envelope.name}.json`
    );
    if (saved) {
      toast.success('Workflow exported');
    }
  }
);
