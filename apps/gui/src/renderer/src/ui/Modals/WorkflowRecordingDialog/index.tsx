import { Button, FaIcon, FloatingDialog, Switch } from '@harborclient/sdk/components';
import type { FloatingDialogPosition, FloatingDialogSize } from '@harborclient/sdk/components';
import { useCallback, useEffect, useState, type JSX } from 'react';
import { faFloppyDisk, faStop, faXmark } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector, useAppStore } from '#/renderer/src/store/hooks';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import {
  closeWorkflowDialog,
  selectPlaybackWorkflowId,
  selectWorkflowDialogMode,
  selectWorkflows,
  setWorkflowSaveNameModalOpen
} from '#/renderer/src/store/slices/workflowsSlice';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
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
  clearPlayback,
  getPlaybackActionCount,
  getPlaybackElapsedMs,
  getPlaybackIndex,
  isPlaybackGapless,
  isPlaying as getIsPlaying,
  loadPlayback,
  restartPlayback,
  seekPlaybackTo,
  setPlaybackGapless,
  startPlayback,
  stepPlaybackCursor,
  stopPlayback,
  subscribePlayback
} from '#/renderer/src/workflows/workflowPlayback';
import {
  DEFAULT_WORKFLOW_RECORDING_DIALOG_POSITION,
  loadWorkflowRecordingDialogPosition,
  saveWorkflowRecordingDialogPosition
} from './workflowRecordingDialogPosition';
import {
  defaultWorkflowPlayDialogGeometry,
  loadWorkflowPlayDialogGeometry,
  saveWorkflowPlayDialogGeometry,
  workflowPlayDialogMinWidth,
  WORKFLOW_PLAY_DIALOG_MIN_HEIGHT_PX
} from './workflowPlayDialogGeometry';
import { WorkflowPlaybackControls } from './WorkflowPlaybackControls';
import { WorkflowTimeline } from './WorkflowTimeline';

/**
 * Floating, non-blocking dialog for recording or playing a workflow session.
 */
export function WorkflowRecordingDialog(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const confirm = useConfirm();
  const dialogMode = useAppSelector(selectWorkflowDialogMode);
  const playbackWorkflowId = useAppSelector(selectPlaybackWorkflowId);
  const workflows = useAppSelector(selectWorkflows);
  const open = dialogMode !== 'closed';
  const isPlayMode = dialogMode === 'play';

  const [recording, setRecording] = useState(() => getIsRecording());
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(() => getRecordingElapsedMs());
  const [actionCount, setActionCount] = useState(() => getSessionEvents().length);

  /**
   * Bumps when the playback module notifies so render re-reads module getters.
   */
  const [playbackTick, setPlaybackTick] = useState(0);

  const recordSavedPosition =
    loadWorkflowRecordingDialogPosition() ?? DEFAULT_WORKFLOW_RECORDING_DIALOG_POSITION;

  /**
   * Resolves initial play dialog geometry once when the dialog mounts.
   *
   * @returns Saved or default full-width geometry.
   */
  const [playGeometry] = useState(() => {
    const defaults = defaultWorkflowPlayDialogGeometry();
    const saved = loadWorkflowPlayDialogGeometry();
    if (saved == null) {
      return defaults;
    }
    return {
      left: saved.left,
      top: saved.top,
      width: Math.max(workflowPlayDialogMinWidth(defaults.width), saved.width),
      height: Math.max(WORKFLOW_PLAY_DIALOG_MIN_HEIGHT_PX, saved.height)
    };
  });

  /**
   * Opening width used to compute the resize min-width floor.
   */
  const [playMinWidth] = useState(() =>
    workflowPlayDialogMinWidth(defaultWorkflowPlayDialogGeometry().width)
  );

  const [playSize, setPlaySize] = useState<FloatingDialogSize>(() => ({
    width: playGeometry.width,
    height: playGeometry.height
  }));
  const [playPosition, setPlayPosition] = useState<FloatingDialogPosition>(() => ({
    left: playGeometry.left,
    top: playGeometry.top
  }));

  const playbackWorkflow = workflows.find((workflow) => workflow.id === playbackWorkflowId);
  const playbackActions = playbackWorkflow?.actions;

  void playbackTick;
  const playing = getIsPlaying();
  const playbackElapsedMs = getPlaybackElapsedMs();
  const playbackIndex = getPlaybackIndex();
  const playbackActionCount = getPlaybackActionCount();
  const gapless = isPlaybackGapless();

  /**
   * Subscribes to playback module updates while play mode is open.
   */
  useEffect(() => {
    if (dialogMode !== 'play') {
      return;
    }

    /**
     * Schedules a re-render from the latest playback module state.
     */
    const bump = (): void => {
      setPlaybackTick((tick) => tick + 1);
    };

    const unsubscribe = subscribePlayback(bump);
    const intervalId = window.setInterval(() => {
      if (getIsPlaying()) {
        bump();
      }
    }, 250);

    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
    };
  }, [dialogMode]);

  /**
   * Loads playback actions when entering play mode, or clears playback otherwise.
   */
  useEffect(() => {
    if (dialogMode === 'play') {
      if (playbackWorkflowId != null && playbackActions == null) {
        dispatch(closeWorkflowDialog());
        return;
      }
      if (playbackActions != null) {
        stopRecording();
        loadPlayback(playbackActions);
      }
      return;
    }

    stopPlayback();
    clearPlayback();
  }, [dialogMode, dispatch, playbackActions, playbackWorkflowId]);

  /**
   * Syncs local UI state from the recorder session while the record dialog is open.
   */
  useEffect(() => {
    if (dialogMode !== 'record') {
      return;
    }

    /**
     * Refreshes recording flag, elapsed time, and action count.
     */
    const syncSession = (): void => {
      setRecording(getIsRecording());
      setRecordingElapsedMs(getRecordingElapsedMs());
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
        setRecordingElapsedMs(getRecordingElapsedMs());
      }
    }, 250);

    return () => {
      unsubscribeSession();
      unsubscribeEvents();
      window.clearInterval(intervalId);
    };
  }, [dialogMode]);

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
    setRecordingElapsedMs(getRecordingElapsedMs());
  }, []);

  /**
   * Opens the save-name modal when the session has recorded actions.
   */
  const handleSave = useCallback((): void => {
    stopRecording();
    setRecording(false);
    setRecordingElapsedMs(getRecordingElapsedMs());
    if (getSessionEvents().length === 0) {
      return;
    }
    dispatch(setWorkflowSaveNameModalOpen(true));
  }, [dispatch]);

  /**
   * Starts or stops automatic workflow playback.
   */
  const handleTogglePlay = useCallback((): void => {
    if (getIsPlaying()) {
      stopPlayback();
      setPlaybackTick((tick) => tick + 1);
      return;
    }

    void startPlayback({
      dispatch,
      getState: store.getState
    })
      .catch((error: unknown) => {
        showAlert(dispatch, formatErrorMessage(error, 'Workflow playback failed'));
      })
      .finally(() => {
        setPlaybackTick((tick) => tick + 1);
      });
  }, [dispatch, store]);

  /**
   * Moves the playback cursor one step backward without dispatching.
   */
  const handleRewind = useCallback((): void => {
    stepPlaybackCursor(-1);
    setPlaybackTick((tick) => tick + 1);
  }, []);

  /**
   * Moves the playback cursor one step forward without dispatching.
   */
  const handleFastForward = useCallback((): void => {
    stepPlaybackCursor(1);
    setPlaybackTick((tick) => tick + 1);
  }, []);

  /**
   * Resets playback to action #0 and clears elapsed time.
   */
  const handleRestart = useCallback((): void => {
    restartPlayback();
    setPlaybackTick((tick) => tick + 1);
  }, []);

  /**
   * Seeks the playback cursor to a timeline block without dispatching.
   *
   * @param index - Target action index.
   */
  const handleSeek = useCallback((index: number): void => {
    seekPlaybackTo(index);
    setPlaybackTick((tick) => tick + 1);
  }, []);

  /**
   * Toggles gapless vs recorded-timing playback.
   *
   * @param checked - True for gapless.
   */
  const handleGaplessChange = useCallback((checked: boolean): void => {
    setPlaybackGapless(checked);
    setPlaybackTick((tick) => tick + 1);
  }, []);

  /**
   * Persists play dialog position after a drag.
   *
   * @param position - New top-left coordinates.
   */
  const handlePlayPositionChange = useCallback(
    (position: FloatingDialogPosition): void => {
      setPlayPosition(position);
      saveWorkflowPlayDialogGeometry({
        left: position.left,
        top: position.top,
        width: playSize.width,
        height: playSize.height
      });
    },
    [playSize.height, playSize.width]
  );

  /**
   * Persists play dialog size after a resize.
   *
   * @param size - New width and height.
   */
  const handlePlaySizeChange = useCallback(
    (size: FloatingDialogSize): void => {
      setPlaySize(size);
      saveWorkflowPlayDialogGeometry({
        left: playPosition.left,
        top: playPosition.top,
        width: size.width,
        height: size.height
      });
    },
    [playPosition.left, playPosition.top]
  );

  /**
   * Closes the dialog, confirming discard when unsaved recording actions exist.
   */
  const handleClose = useCallback(async (): Promise<void> => {
    if (isPlayMode) {
      stopPlayback();
      clearPlayback();
      dispatch(closeWorkflowDialog());
      return;
    }

    stopRecording();
    const hasActions = getSessionEvents().length > 0;
    if (hasActions) {
      const confirmed = await confirm({
        title: 'Discard recording?',
        message: 'Close without saving? Recorded actions will be lost.',
        confirmLabel: 'Discard',
        variant: 'danger'
      });
      if (!confirmed) {
        return;
      }
    }
    clearSession();
    dispatch(closeWorkflowDialog());
  }, [confirm, dispatch, isPlayMode]);

  if (!open) {
    return null;
  }

  if (isPlayMode) {
    const title = playbackWorkflow?.name ?? 'Run workflow';
    const titleId = 'workflow-play-dialog-title';
    const recordedDuration = playbackWorkflow?.durationMs ?? 0;
    const playbackActionsList = playbackActions ?? [];

    return (
      <FloatingDialog
        label={title}
        labelledBy={titleId}
        onClose={() => {
          void handleClose();
        }}
        initialLeft={playGeometry.left}
        initialTop={playGeometry.top}
        initialWidth={playGeometry.width}
        initialHeight={playGeometry.height}
        minWidth={playMinWidth}
        minHeight={WORKFLOW_PLAY_DIALOG_MIN_HEIGHT_PX}
        onPositionChange={handlePlayPositionChange}
        onSizeChange={handlePlaySizeChange}
        bodyClassName="flex min-h-0 flex-col gap-3 p-3"
        dragHandle={
          <div className="flex items-center justify-between gap-2 border-b border-separator px-3 py-2">
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-[15px] font-semibold">
                {title}
              </h2>
              <p className="truncate text-[14px] text-muted">
                {formatWorkflowDuration(recordedDuration)} recorded
              </p>
            </div>
            <button
              type="button"
              className="rounded p-1 text-muted hover:bg-surface-raised hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              aria-label="Close run dialog"
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">
            <WorkflowPlaybackControls
              playing={playing}
              actionIndex={playbackIndex}
              actionCount={playbackActionCount}
              onTogglePlay={handleTogglePlay}
              onRewind={handleRewind}
              onFastForward={handleFastForward}
              onRestart={handleRestart}
              compact
            />
          </div>
          <p className="font-mono text-[15px] tabular-nums" aria-live="polite">
            {formatWorkflowDuration(playbackElapsedMs)}
            <span className="text-muted"> / {formatWorkflowDuration(recordedDuration)}</span>
          </p>
          <label className="inline-flex items-center gap-2 text-[14px]">
            <Switch
              checked={gapless}
              onChange={(event) => {
                handleGaplessChange(event.target.checked);
              }}
              aria-label="Gapless playback"
            />
            Gapless
          </label>
        </div>
        <WorkflowTimeline
          actions={playbackActionsList}
          durationMs={recordedDuration}
          selectedIndex={playbackIndex}
          playing={playing}
          getState={store.getState}
          onSeek={handleSeek}
        />
      </FloatingDialog>
    );
  }

  const title = 'Record workflow';
  const titleId = 'workflow-recording-dialog-title';

  return (
    <FloatingDialog
      label={title}
      labelledBy={titleId}
      onClose={() => {
        void handleClose();
      }}
      initialLeft={recordSavedPosition.left}
      initialTop={recordSavedPosition.top}
      onPositionChange={saveWorkflowRecordingDialogPosition}
      className="w-72"
      dragHandle={
        <div className="flex items-center justify-between gap-2 border-b border-separator px-3 py-2">
          <h2 id={titleId} className="text-[15px] font-semibold">
            {title}
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
            {formatWorkflowDuration(recordingElapsedMs)}
          </p>
          <p className="text-muted" aria-live="polite">
            {`${actionCount} action${actionCount === 1 ? '' : 's'}`}
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
