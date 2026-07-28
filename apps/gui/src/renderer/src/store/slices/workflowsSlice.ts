import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Workflow } from '@harborclient/core/types';
import type { RootState } from '#/renderer/src/store/redux';

/**
 * Visibility mode for the shared floating workflow dialog.
 */
export type WorkflowDialogMode = 'closed' | 'record' | 'play';

/**
 * Redux state for persisted workflows and the floating session dialog.
 */
export interface WorkflowsState {
  /**
   * Workflows loaded from the local registry.
   */
  items: Workflow[];

  /**
   * Whether the floating dialog is closed, recording, or playing back.
   */
  dialogMode: WorkflowDialogMode;

  /**
   * Workflow id loaded for play mode; null when not playing.
   */
  playbackWorkflowId: number | null;

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
  dialogMode: 'closed',
  playbackWorkflowId: null,
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
     * Opens the floating dialog in record mode and clears any playback target.
     */
    openWorkflowRecordDialog(state) {
      state.dialogMode = 'record';
      state.playbackWorkflowId = null;
    },

    /**
     * Opens the floating dialog in play mode for the given workflow.
     *
     * @param state - Workflows slice state.
     * @param action - Workflow database id to play.
     */
    openWorkflowPlayDialog(state, action: PayloadAction<number>) {
      state.dialogMode = 'play';
      state.playbackWorkflowId = action.payload;
      state.saveNameModalOpen = false;
      state.saveError = null;
      state.saving = false;
    },

    /**
     * Closes the floating dialog and clears playback / save UI state.
     */
    closeWorkflowDialog(state) {
      state.dialogMode = 'closed';
      state.playbackWorkflowId = null;
      state.saveNameModalOpen = false;
      state.saveError = null;
      state.saving = false;
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
  openWorkflowRecordDialog,
  openWorkflowPlayDialog,
  closeWorkflowDialog,
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
 * Selects the floating workflow dialog mode.
 *
 * @param state - Root Redux state.
 * @returns Closed, record, or play.
 */
export function selectWorkflowDialogMode(state: RootState): WorkflowDialogMode {
  return state.workflows.dialogMode;
}

/**
 * Selects the workflow id loaded for play mode.
 *
 * @param state - Root Redux state.
 * @returns Workflow id or null.
 */
export function selectPlaybackWorkflowId(state: RootState): number | null {
  return state.workflows.playbackWorkflowId;
}

/**
 * Selects whether the floating dialog is open in any mode.
 *
 * @param state - Root Redux state.
 * @returns True when record or play mode is active.
 */
export function selectWorkflowDialogOpen(state: RootState): boolean {
  return state.workflows.dialogMode !== 'closed';
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
