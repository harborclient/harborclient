import { describe, expect, it } from 'vitest';
import type { RootState } from '#/renderer/src/store/redux';
import workflowsReducer, {
  closeWorkflowDialog,
  enterWorkflowEditFromPlay,
  openWorkflowEditDialog,
  openWorkflowPlayDialog,
  openWorkflowRecordDialog,
  selectEditEnteredFromPlay,
  type WorkflowsState
} from './workflowsSlice';

/**
 * Builds a minimal root state for workflow selectors.
 *
 * @param workflows - Partial workflows slice overrides.
 * @returns Root-shaped state with the workflows slice filled in.
 */
function rootWithWorkflows(workflows: WorkflowsState): RootState {
  return { workflows } as RootState;
}

describe('workflowsSlice', () => {
  it('starts closed with editEnteredFromPlay false', () => {
    const state = workflowsReducer(undefined, { type: 'unknown' });
    expect(state.dialogMode).toBe('closed');
    expect(state.editEnteredFromPlay).toBe(false);
    expect(state.playbackWorkflowId).toBeNull();
  });

  it('opens play mode and clears editEnteredFromPlay', () => {
    const fromEdit: WorkflowsState = {
      ...workflowsReducer(undefined, { type: 'unknown' }),
      dialogMode: 'edit',
      playbackWorkflowId: 7,
      editEnteredFromPlay: true
    };
    const state = workflowsReducer(fromEdit, openWorkflowPlayDialog(3));
    expect(state.dialogMode).toBe('play');
    expect(state.playbackWorkflowId).toBe(3);
    expect(state.editEnteredFromPlay).toBe(false);
  });

  it('opens edit mode from the sidebar without marking editEnteredFromPlay', () => {
    const state = workflowsReducer(undefined, openWorkflowEditDialog(9));
    expect(state.dialogMode).toBe('edit');
    expect(state.playbackWorkflowId).toBe(9);
    expect(state.editEnteredFromPlay).toBe(false);
  });

  it('enters edit from play and sets editEnteredFromPlay', () => {
    let state = workflowsReducer(undefined, openWorkflowPlayDialog(4));
    state = workflowsReducer(state, enterWorkflowEditFromPlay());
    expect(state.dialogMode).toBe('edit');
    expect(state.playbackWorkflowId).toBe(4);
    expect(state.editEnteredFromPlay).toBe(true);
    expect(selectEditEnteredFromPlay(rootWithWorkflows(state))).toBe(true);
  });

  it('no-ops enterWorkflowEditFromPlay when not in play mode', () => {
    const closed = workflowsReducer(undefined, enterWorkflowEditFromPlay());
    expect(closed.dialogMode).toBe('closed');
    expect(closed.editEnteredFromPlay).toBe(false);

    const fromSidebarEdit = workflowsReducer(undefined, openWorkflowEditDialog(2));
    const stillEdit = workflowsReducer(fromSidebarEdit, enterWorkflowEditFromPlay());
    expect(stillEdit.dialogMode).toBe('edit');
    expect(stillEdit.editEnteredFromPlay).toBe(false);
  });

  it('clears editEnteredFromPlay when opening record or closing', () => {
    let state = workflowsReducer(undefined, openWorkflowPlayDialog(1));
    state = workflowsReducer(state, enterWorkflowEditFromPlay());
    expect(state.editEnteredFromPlay).toBe(true);

    const afterRecord = workflowsReducer(state, openWorkflowRecordDialog());
    expect(afterRecord.dialogMode).toBe('record');
    expect(afterRecord.editEnteredFromPlay).toBe(false);

    state = workflowsReducer(undefined, openWorkflowPlayDialog(1));
    state = workflowsReducer(state, enterWorkflowEditFromPlay());
    const afterClose = workflowsReducer(state, closeWorkflowDialog());
    expect(afterClose.dialogMode).toBe('closed');
    expect(afterClose.editEnteredFromPlay).toBe(false);
  });
});
