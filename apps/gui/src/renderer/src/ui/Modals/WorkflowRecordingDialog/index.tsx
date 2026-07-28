import { Button, FaIcon, FloatingDialog } from '@harborclient/sdk/components';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { faFloppyDisk, faStop, faXmark } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import {
  selectWorkflowRecordingDialogOpen,
  setWorkflowRecordingDialogOpen,
  setWorkflowSaveNameModalOpen
} from '#/renderer/src/store/slices/workflowsSlice';
import { formatWorkflowDuration } from '#/renderer/src/workflows/formatWorkflowDuration';
import {
  clearSession,
  getRecordingElapsedMs,
  getSessionEvents,
  getWorkflowLogApi,
  isRecording as getIsRecording,
  startRecording,
  stopRecording,
  subscribeRecordingSession
} from '#/renderer/src/workflows/workflowRecorder';
import {
  DEFAULT_WORKFLOW_RECORDING_DIALOG_POSITION,
  loadWorkflowRecordingDialogPosition,
  saveWorkflowRecordingDialogPosition
} from './workflowRecordingDialogPosition';

/**
 * Floating, non-blocking dialog for recording a workflow session.
 */
export function WorkflowRecordingDialog(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const open = useAppSelector(selectWorkflowRecordingDialogOpen);
  const [recording, setRecording] = useState(() => getIsRecording());
  const [elapsedMs, setElapsedMs] = useState(() => getRecordingElapsedMs());
  const [actionCount, setActionCount] = useState(() => getSessionEvents().length);
  const savedPosition =
    loadWorkflowRecordingDialogPosition() ?? DEFAULT_WORKFLOW_RECORDING_DIALOG_POSITION;

  /**
   * Syncs local UI state from the recorder session while the dialog is open.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    /**
     * Refreshes recording flag, elapsed time, and action count.
     */
    const syncSession = (): void => {
      setRecording(getIsRecording());
      setElapsedMs(getRecordingElapsedMs());
      setActionCount(getSessionEvents().length);
    };

    syncSession();
    const unsubscribeSession = subscribeRecordingSession(syncSession);
    const unsubscribeEvents = getWorkflowLogApi().subscribe(() => {
      setActionCount(getSessionEvents().length);
    });
    const intervalId = window.setInterval(() => {
      setActionCount(getSessionEvents().length);
      if (getIsRecording()) {
        setElapsedMs(getRecordingElapsedMs());
      }
    }, 250);

    return () => {
      unsubscribeSession();
      unsubscribeEvents();
      window.clearInterval(intervalId);
    };
  }, [open]);

  /**
   * Toggles recording on or off without clearing the session buffer.
   */
  const handleToggleRecord = useCallback((): void => {
    if (getIsRecording()) {
      stopRecording();
    } else {
      startRecording();
    }
    setRecording(getIsRecording());
    setElapsedMs(getRecordingElapsedMs());
  }, []);

  /**
   * Opens the save-name modal when the session has recorded actions.
   */
  const handleSave = useCallback((): void => {
    stopRecording();
    setRecording(false);
    setElapsedMs(getRecordingElapsedMs());
    if (getSessionEvents().length === 0) {
      return;
    }
    dispatch(setWorkflowSaveNameModalOpen(true));
  }, [dispatch]);

  /**
   * Closes the dialog, confirming discard when unsaved actions exist.
   */
  const handleClose = useCallback(async (): Promise<void> => {
    stopRecording();
    const hasActions = getSessionEvents().length > 0;
    if (hasActions) {
      const confirmed = await confirm({
        title: 'Discard recording?',
        message: 'This recording has unsaved actions. Close without saving?',
        confirmLabel: 'Discard',
        variant: 'danger'
      });
      if (!confirmed) {
        return;
      }
    }
    clearSession();
    dispatch(setWorkflowRecordingDialogOpen(false));
  }, [confirm, dispatch]);

  if (!open) {
    return null;
  }

  return (
    <FloatingDialog
      label="Record workflow"
      labelledBy="workflow-recording-dialog-title"
      onClose={() => {
        void handleClose();
      }}
      initialLeft={savedPosition.left}
      initialTop={savedPosition.top}
      onPositionChange={saveWorkflowRecordingDialogPosition}
      className="w-72"
      dragHandle={
        <div className="flex items-center justify-between gap-2 border-b border-separator px-3 py-2">
          <h2 id="workflow-recording-dialog-title" className="text-[15px] font-semibold">
            Record workflow
          </h2>
          <button
            type="button"
            className="rounded p-1 text-muted hover:bg-surface-raised hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            aria-label="Close recording dialog"
            onClick={(event) => {
              event.stopPropagation();
              void handleClose();
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <FaIcon icon={faXmark} className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[15px] tabular-nums" aria-live="polite">
            {formatWorkflowDuration(elapsedMs)}
          </p>
          <p className="text-muted" aria-live="polite">
            {actionCount} action{actionCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={recording ? 'primaryDanger' : 'primary'}
            className="flex-1"
            onClick={handleToggleRecord}
            aria-pressed={recording}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {recording ? (
                <FaIcon icon={faStop} className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <span className="inline-block h-3 w-3 rounded-full bg-danger" aria-hidden />
              )}
              {recording ? 'Stop' : 'Record'}
            </span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            disabled={actionCount === 0}
            onClick={handleSave}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <FaIcon icon={faFloppyDisk} className="h-3.5 w-3.5" aria-hidden />
              Save
            </span>
          </Button>
        </div>
      </div>
    </FloatingDialog>
  );
}
