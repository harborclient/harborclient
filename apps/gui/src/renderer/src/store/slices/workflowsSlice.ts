import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Workflow } from '@harborclient/core/types';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Redux state for persisted workflows and recording dialog visibility.
 */
export interface WorkflowsState {
  /**
   * Workflows loaded from the local registry.
   */
  items: Workflow[];

  /**
   * True when the floating recording dialog is open.
   */
  recordingDialogOpen: boolean;

  /**
   * True when the save-name modal is open.
   */
  saveNameModalOpen: boolean;

  /**
   * Inline error from the last save attempt.
   */
  saveError: string | null;

  /**
   * True while createWorkflow IPC is in flight.
   */
  saving: boolean;
}

const initialState: WorkflowsState = {
  items: [],
  recordingDialogOpen: false,
  saveNameModalOpen: false,
  saveError: null,
  saving: false
};

const workflowsSlice = createSlice({
  name: 'workflows',
  initialState,
  reducers: {
    /**
     * Replaces the workflow list after refresh or persistence.
     */
    setWorkflows(state, action: PayloadAction<Workflow[]>) {
      state.items = action.payload;
    },

    /**
     * Opens or closes the floating recording dialog.
     */
    setWorkflowRecordingDialogOpen(state, action: PayloadAction<boolean>) {
      state.recordingDialogOpen = action.payload;
      if (!action.payload) {
        state.saveNameModalOpen = false;
        state.saveError = null;
        state.saving = false;
      }
    },

    /**
     * Opens or closes the save-name modal.
     */
    setWorkflowSaveNameModalOpen(state, action: PayloadAction<boolean>) {
      state.saveNameModalOpen = action.payload;
      if (!action.payload) {
        state.saveError = null;
        state.saving = false;
      }
    },

    /**
     * Stores an inline save error message.
     */
    setWorkflowSaveError(state, action: PayloadAction<string | null>) {
      state.saveError = action.payload;
    },

    /**
     * Tracks whether a workflow save is in flight.
     */
    setWorkflowSaving(state, action: PayloadAction<boolean>) {
      state.saving = action.payload;
    }
  }
});

export const {
  setWorkflows,
  setWorkflowRecordingDialogOpen,
  setWorkflowSaveNameModalOpen,
  setWorkflowSaveError,
  setWorkflowSaving
} = workflowsSlice.actions;

/**
 * Selects all workflows currently loaded in the store.
 *
 * @param state - Root Redux state.
 * @returns Workflow list.
 */
export function selectWorkflows(state: RootState): Workflow[] {
  return state.workflows.items;
}

/**
 * Selects whether the recording dialog is open.
 *
 * @param state - Root Redux state.
 * @returns True when the floating dialog should render.
 */
export function selectWorkflowRecordingDialogOpen(state: RootState): boolean {
  return state.workflows.recordingDialogOpen;
}

/**
 * Selects whether the save-name modal is open.
 *
 * @param state - Root Redux state.
 * @returns True when the name modal should render.
 */
export function selectWorkflowSaveNameModalOpen(state: RootState): boolean {
  return state.workflows.saveNameModalOpen;
}

/**
 * Selects the current workflow save error, if any.
 *
 * @param state - Root Redux state.
 * @returns Error message or null.
 */
export function selectWorkflowSaveError(state: RootState): string | null {
  return state.workflows.saveError;
}

/**
 * Selects whether a workflow save is in flight.
 *
 * @param state - Root Redux state.
 * @returns True while creating a workflow.
 */
export function selectWorkflowSaving(state: RootState): boolean {
  return state.workflows.saving;
}

export default workflowsSlice.reducer;
