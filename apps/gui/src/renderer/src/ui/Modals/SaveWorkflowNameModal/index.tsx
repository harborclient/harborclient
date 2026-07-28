import { PromptModal } from '@harborclient/sdk/components';
import { useCallback, useState, type JSX } from 'react';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectWorkflowSaveError,
  selectWorkflowSaveNameModalOpen,
  selectWorkflowSaving,
  setWorkflowSaveNameModalOpen
} from '#/renderer/src/store/slices/workflowsSlice';
import { createWorkflowFromSession } from '#/renderer/src/store/thunks/workflows';

/**
 * Inner prompt body that remounts when the save modal opens so the name resets.
 */
function SaveWorkflowNameModalContent(): JSX.Element {
  const dispatch = useAppDispatch();
  const saving = useAppSelector(selectWorkflowSaving);
  const error = useAppSelector(selectWorkflowSaveError);
  const [name, setName] = useState('Untitled workflow');

  /**
   * Closes the name modal without saving.
   */
  const handleClose = useCallback((): void => {
    if (saving) {
      return;
    }
    dispatch(setWorkflowSaveNameModalOpen(false));
  }, [dispatch, saving]);

  /**
   * Persists the current recording session under the entered name.
   */
  const handleSubmit = useCallback((): void => {
    void dispatch(createWorkflowFromSession(name));
  }, [dispatch, name]);

  return (
    <PromptModal
      title="Save workflow"
      labelledBy="save-workflow-name-title"
      label="Workflow name"
      value={name}
      onChange={setName}
      onSubmit={handleSubmit}
      onClose={handleClose}
      submitLabel="Save"
      busy={saving}
      error={error}
    />
  );
}

/**
 * Blocking name prompt shown when saving a recorded workflow.
 */
export function SaveWorkflowNameModal(): JSX.Element | null {
  const open = useAppSelector(selectWorkflowSaveNameModalOpen);

  if (!open) {
    return null;
  }

  return <SaveWorkflowNameModalContent key="save-workflow-name" />;
}
