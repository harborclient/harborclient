import { Button, FaIcon, FloatingDialog, Switch } from '@harborclient/sdk/components';
import type { FloatingDialogPosition, FloatingDialogSize } from '@harborclient/sdk/components';
import type { WorkflowAction, WorkflowRunActionResult } from '@harborclient/core/types';
import type { WorkflowPanelPluginMode } from '@harborclient/sdk';
import {
  acceleratorMatchesChord,
  getShortcutDef,
  type KeyChord
} from '@harborclient/core/shortcuts';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX
} from 'react';
import { faEraser, faFloppyDisk, faList, faPenToSquare, faXmark } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector, useAppStore } from '#/renderer/src/store/hooks';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import {
  closeWorkflowDialog,
  enterWorkflowEditFromPlay,
  openWorkflowPlayDialog,
  selectEditEnteredFromPlay,
  selectPlaybackWorkflowId,
  selectWorkflowDialogMode,
  selectWorkflows,
  setWorkflowSaveNameModalOpen,
  type WorkflowPanelMode
} from '#/renderer/src/store/slices/workflowsSlice';
import { updateWorkflowActions } from '#/renderer/src/store/thunks/workflows';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import { formatWorkflowDuration } from '#/renderer/src/workflows/formatWorkflowDuration';
import {
  canMoveWorkflowAction,
  cursorAfterDelete,
  cursorAfterMove,
  deleteWorkflowActionAt,
  swapWorkflowActions,
  updateWorkflowActionPayloadAt,
  type WorkflowActionMoveDirection
} from '#/renderer/src/workflows/workflowActionEdits';
import { startWorkflowElapsedClock } from '#/renderer/src/workflows/workflowElapsedClock';
import {
  clearSession,
  getRecordingElapsedMs,
  getSessionEvents,
  getWorkflowLogApi,
  isRecording as getIsRecording,
  replaceSessionActions,
  seekRecordingTo,
  startRecording,
  stopRecording,
  subscribeRecordingSession
} from '#/renderer/src/workflows/workflowRecorder';
import {
  clearPlayback,
  getPlaybackActionCount,
  getPlaybackActions,
  getPlaybackDelayMs,
  getPlaybackElapsedMs,
  getPlaybackIndex,
  getPlaybackPlayheadTimelineMs,
  isPlaybackGapless,
  isPlaying as getIsPlaying,
  loadPlayback,
  replacePlaybackActions,
  resetPlaybackAndClearResults,
  restartPlayback,
  seekPlaybackTo,
  setPlaybackDelayMs,
  setPlaybackGapless,
  startPlayback,
  stepPlaybackCursor,
  stopPlayback,
  subscribePlayback
} from '#/renderer/src/workflows/workflowPlayback';
import {
  getWorkflowRunLog,
  getWorkflowRunLogMeta,
  getWorkflowRunLogVersion,
  subscribeWorkflowRunLog
} from '#/renderer/src/workflows/workflowRunLog';
import { enrichWorkflowSendDisplayFields } from '#/renderer/src/workflows/enrichWorkflowSendDisplayFields';
import { describeWorkflowAction } from '#/renderer/src/workflows/timeline/workflowThumbnails';
import { WorkflowPlayDialogTitle } from './WorkflowPlayDialogTitle';
import { WorkflowEditControls } from './WorkflowEditControls';
import { WorkflowPlaybackControls } from './WorkflowPlaybackControls';
import { WorkflowActionPayloadModal } from './WorkflowActionPayloadModal';
import { WorkflowTimeline } from './WorkflowTimeline';
import {
  defaultWorkflowPlayDialogGeometry,
  loadWorkflowPlayDialogGeometry,
  saveWorkflowPlayDialogGeometry,
  workflowPlayDialogMinWidth,
  WORKFLOW_PLAY_DIALOG_MIN_HEIGHT_PX
} from './workflowPlayDialogGeometry';

/**
 * Builds a normalized keyboard chord from a browser keydown event.
 *
 * @param event - Keydown event from the document.
 * @returns Chord suitable for shortcut matching.
 */
function chordFromKeyboardEvent(event: KeyboardEvent): KeyChord {
  return {
    key: event.key,
    control: event.ctrlKey,
    meta: event.metaKey,
    shift: event.shiftKey,
    alt: event.altKey
  };
}

/**
 * Narrows the Redux dialog mode to an active panel mode for plugin contexts.
 *
 * @param mode - Redux workflow dialog mode.
 * @returns Plugin mode, or null when the panel is closed.
 */
function toPanelMode(mode: string): WorkflowPanelMode | null {
  if (mode === 'record' || mode === 'play' || mode === 'edit') {
    return mode;
  }
  return null;
}

/**
 * Floating dialog for recording, playing, or editing a workflow timeline.
 */
export function WorkflowPanel(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const confirm = useConfirm();
  const dialogMode = useAppSelector(selectWorkflowDialogMode);
  const playbackWorkflowId = useAppSelector(selectPlaybackWorkflowId);
  const editEnteredFromPlay = useAppSelector(selectEditEnteredFromPlay);
  const workflows = useAppSelector(selectWorkflows);
  const open = dialogMode !== 'closed';
  const panelMode = toPanelMode(dialogMode);
  const isRecordMode = dialogMode === 'record';
  const isPlayMode = dialogMode === 'play';
  const isEditMode = dialogMode === 'edit';
  const isPlaybackSession = isPlayMode || isEditMode;
  /**
   * Timeline context-menu / payload edits are available in edit mode and while
   * a recording is paused (blocks are disabled while actively recording).
   */
  const editable = isEditMode || isRecordMode;
  /**
   * Stable id for the dialog title heading (aria-labelledby).
   */
  const titleId = 'workflow-floating-dialog-title';
  /**
   * Stable id for the gapless playback switch label association.
   */
  const gaplessId = useId();

  const [recording, setRecording] = useState(() => getIsRecording());
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(() => getRecordingElapsedMs());
  const [recordedActions, setRecordedActions] = useState<WorkflowAction[]>(() =>
    enrichWorkflowSendDisplayFields([...getSessionEvents()], { getState: store.getState })
  );
  const [recordSelectedIndex, setRecordSelectedIndex] = useState(0);

  /**
   * Bumps when the playback module notifies so render re-reads module getters.
   */
  const [playbackTick, setPlaybackTick] = useState(0);

  /**
   * Subscribes to run-log version so Reset enablement and timeline status update
   * when a run starts, appends, or clears.
   */
  const runLogVersion = useSyncExternalStore(subscribeWorkflowRunLog, getWorkflowRunLogVersion);
  const runLogMeta = getWorkflowRunLogMeta();
  const hasRunLog = runLogMeta != null;

  /**
   * True when the edit-mode buffer has unsaved timeline edits.
   */
  const [dirty, setDirty] = useState(false);

  /**
   * Draft inter-step delay for the open play/edit session.
   */
  const [delayMs, setDelayMs] = useState(0);

  /**
   * Index of the action whose payload is open in the JSON editor, or null when closed.
   */
  const [payloadEditIndex, setPayloadEditIndex] = useState<number | null>(null);

  /**
   * Session identity used to reset dirty when mode or workflow changes.
   */
  const [dirtyScope, setDirtyScope] = useState({
    mode: dialogMode,
    id: playbackWorkflowId
  });

  if (dirtyScope.mode !== dialogMode || dirtyScope.id !== playbackWorkflowId) {
    setDirtyScope({ mode: dialogMode, id: playbackWorkflowId });
    setDirty(false);
    setPayloadEditIndex(null);
    setRecordSelectedIndex(0);
    const workflowDelay =
      playbackWorkflowId == null
        ? 0
        : (workflows.find((item) => item.id === playbackWorkflowId)?.delayMs ?? 0);
    setDelayMs(workflowDelay);
  }

  /**
   * True while an explicit workflow save is in flight.
   */
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  /**
   * Effective accelerator for the configured `save` shortcut.
   */
  const [saveAccelerator, setSaveAccelerator] = useState(
    () => getShortcutDef('save')?.defaultAccelerator ?? 'CmdOrCtrl+S'
  );

  /**
   * Resolves initial dialog geometry once when the panel mounts.
   *
   * @returns Saved or default geometry (60vw when no saved size).
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

  /**
   * Maps action uuid → run-log result for the open play workflow so timeline
   * send blocks match Results rows (method/name + status metrics).
   */
  const runLogByActionUuid = useMemo(() => {
    void runLogVersion;
    const map = new Map<string, { result: WorkflowRunActionResult }>();
    if (playbackWorkflow == null || runLogMeta?.workflowUuid !== playbackWorkflow.uuid) {
      return map;
    }
    for (const entry of getWorkflowRunLog()) {
      map.set(entry.action.uuid, { result: entry.result });
    }
    return map;
  }, [playbackWorkflow, runLogMeta?.workflowUuid, runLogVersion]);

  void playbackTick;
  const playing = getIsPlaying();
  const playbackElapsedMs = getPlaybackElapsedMs();
  const playbackIndex = getPlaybackIndex();
  const playbackActionCount = getPlaybackActionCount();
  const playbackActionsList = [...getPlaybackActions()];
  const gapless = isPlaybackGapless();

  const timelineActions = isRecordMode ? recordedActions : playbackActionsList;
  const timelineDurationMs = isRecordMode
    ? recordingElapsedMs
    : (playbackWorkflow?.durationMs ?? 0);
  const timelineSelectedIndex = isRecordMode
    ? Math.min(recordSelectedIndex, Math.max(0, recordedActions.length - 1))
    : playbackIndex;
  const timelineBusy = isRecordMode ? recording : playing;
  const pluginMode: WorkflowPanelPluginMode = panelMode ?? 'edit';
  const timelinePlayheadMs = isRecordMode
    ? undefined
    : getPlaybackPlayheadTimelineMs(timelineDurationMs);

  /**
   * Subscribes to playback module updates while play or edit mode is open.
   */
  useEffect(() => {
    if (!isPlaybackSession) {
      return;
    }

    /**
     * Schedules a re-render from the latest playback module state.
     */
    const bump = (): void => {
      setPlaybackTick((tick) => tick + 1);
    };

    const unsubscribe = subscribePlayback(bump);
    /**
     * Drives live elapsed and playhead updates while playback is running.
     */
    const stopElapsedClock = startWorkflowElapsedClock(bump, {
      shouldTick: getIsPlaying
    });

    return () => {
      unsubscribe();
      stopElapsedClock();
    };
  }, [isPlaybackSession]);

  /**
   * Loads playback actions when entering play or edit mode or switching workflows.
   *
   * Intentionally omits Redux `actions` so in-panel edits do not reset the cursor
   * via {@link loadPlayback}. Dirty state resets via the session scope above.
   */
  useEffect(() => {
    if (dialogMode !== 'play' && dialogMode !== 'edit') {
      stopPlayback();
      clearPlayback();
      return;
    }

    if (playbackWorkflowId == null) {
      dispatch(closeWorkflowDialog());
      return;
    }

    const workflow = store
      .getState()
      .workflows.items.find((item) => item.id === playbackWorkflowId);
    if (workflow == null) {
      dispatch(closeWorkflowDialog());
      return;
    }

    stopRecording();
    loadPlayback(workflow.actions, workflow.uuid, workflow.delayMs, store.getState);
  }, [dialogMode, dispatch, playbackWorkflowId, store]);

  /**
   * Loads the effective save shortcut from user settings while edit mode is open.
   */
  useEffect(() => {
    if (dialogMode !== 'edit') {
      return;
    }

    let cancelled = false;

    void window.api.getShortcuts().then((bindings) => {
      if (cancelled) {
        return;
      }

      const saveBinding = bindings.find((binding) => binding.id === 'save');
      if (saveBinding != null) {
        setSaveAccelerator(saveBinding.accelerator);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [dialogMode]);

  /**
   * Syncs local UI state from the recorder session while the record panel is open.
   */
  useEffect(() => {
    if (dialogMode !== 'record') {
      return;
    }

    /**
     * Refreshes recorded actions. While recording, keeps the playhead on the
     * latest step; while paused, leaves selection to seek / edit handlers.
     */
    const syncActions = (): void => {
      const events = enrichWorkflowSendDisplayFields([...getSessionEvents()], {
        getState: store.getState
      });
      setRecordedActions(events);
      if (getIsRecording()) {
        setRecordSelectedIndex(events.length === 0 ? 0 : events.length - 1);
      }
    };

    /**
     * Refreshes recording flag, elapsed time, and action list.
     */
    const syncSession = (): void => {
      setRecording(getIsRecording());
      setRecordingElapsedMs(getRecordingElapsedMs());
      syncActions();
    };

    syncSession();
    const unsubscribeSession = subscribeRecordingSession(syncSession);
    const unsubscribeEvents = getWorkflowLogApi().subscribe(() => {
      syncActions();
    });
    /**
     * Drives live elapsed time for smooth timeline growth while recording.
     * Action list sync stays on session/event subscriptions only.
     */
    const stopElapsedClock = startWorkflowElapsedClock(
      () => {
        setRecordingElapsedMs(getRecordingElapsedMs());
      },
      { shouldTick: getIsRecording }
    );

    return () => {
      unsubscribeSession();
      unsubscribeEvents();
      stopElapsedClock();
    };
  }, [dialogMode, store]);

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
  const handleSaveRecording = useCallback((): void => {
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
   *
   * Restarts from the beginning when Play is pressed after the run has finished.
   */
  const handleTogglePlay = useCallback((): void => {
    if (getIsPlaying()) {
      stopPlayback();
      setPlaybackTick((tick) => tick + 1);
      return;
    }

    if (getPlaybackIndex() >= getPlaybackActionCount()) {
      restartPlayback();
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
   * Opens the workflow run results page tab for the current workflow.
   */
  const handleOpenResults = useCallback((): void => {
    if (playbackWorkflow == null) {
      return;
    }
    dispatch(
      openPageTab({
        type: 'workflow-run-results',
        workflowUuid: playbackWorkflow.uuid
      })
    );
  }, [dispatch, playbackWorkflow]);

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
   * Clears the run results log and moves the playhead back to 0 seconds.
   */
  const handleResetResults = useCallback((): void => {
    resetPlaybackAndClearResults();
    setPlaybackTick((tick) => tick + 1);
  }, []);

  /**
   * Switches the open play session into edit mode so a later save can return to play.
   */
  const handleEnterEditFromPlay = useCallback((): void => {
    if (getIsPlaying()) {
      return;
    }
    dispatch(enterWorkflowEditFromPlay());
  }, [dispatch]);

  /**
   * Seeks the playback cursor, or while a recording is paused restores app state
   * at the playhead without deleting later blocks (resume truncates).
   *
   * @param index - Target action index.
   */
  const handleSeek = useCallback(
    (index: number): void => {
      if (isRecordMode) {
        if (getIsRecording()) {
          return;
        }
        const playheadIndex = seekRecordingTo(index, { dispatch: store.dispatch });
        if (playheadIndex >= 0) {
          setRecordSelectedIndex(playheadIndex);
        }
        setRecordingElapsedMs(getRecordingElapsedMs());
        setRecordedActions(
          enrichWorkflowSendDisplayFields([...getSessionEvents()], { getState: store.getState })
        );
        return;
      }
      seekPlaybackTo(index);
      setPlaybackTick((tick) => tick + 1);
    },
    [isRecordMode, store]
  );

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
   * Updates the inter-step delay draft; marks dirty only in edit mode.
   *
   * @param nextDelayMs - Delay in milliseconds between consecutive actions.
   */
  const handleDelayMsChange = useCallback(
    (nextDelayMs: number): void => {
      setDelayMs(nextDelayMs);
      setPlaybackDelayMs(nextDelayMs);
      if (isEditMode) {
        setDirty(true);
      }
      setPlaybackTick((tick) => tick + 1);
    },
    [isEditMode]
  );

  /**
   * Applies a timeline edit to the playback buffer without persisting.
   *
   * @param nextActions - Actions after the edit.
   * @param nextIndex - Playback cursor after the edit.
   */
  const applyLocalEdit = useCallback(
    (nextActions: WorkflowAction[], nextIndex: number): void => {
      replacePlaybackActions(nextActions, nextIndex, store.getState);
      setDirty(true);
      setPlaybackTick((tick) => tick + 1);
    },
    [store]
  );

  /**
   * Applies a timeline edit to the paused recording session buffer.
   *
   * @param nextActions - Actions after the edit.
   * @param nextIndex - Selection index after the edit.
   */
  const applyRecordEdit = useCallback(
    (nextActions: WorkflowAction[], nextIndex: number): void => {
      const clamped =
        nextActions.length === 0 ? 0 : Math.min(Math.max(0, nextIndex), nextActions.length - 1);
      replaceSessionActions(nextActions, store.getState, clamped);
      setRecordSelectedIndex(clamped);
      setRecordedActions(
        enrichWorkflowSendDisplayFields([...getSessionEvents()], { getState: store.getState })
      );
      setRecordingElapsedMs(getRecordingElapsedMs());
    },
    [store]
  );

  /**
   * Seeks to an action and opens the payload JSON editor when edits are allowed.
   *
   * @param index - Action index to edit.
   */
  const handleEditPayload = useCallback(
    (index: number): void => {
      if (!editable) {
        return;
      }
      if (isRecordMode) {
        if (getIsRecording()) {
          return;
        }
        const playheadIndex = seekRecordingTo(index, { dispatch: store.dispatch });
        if (playheadIndex < 0) {
          return;
        }
        setRecordSelectedIndex(playheadIndex);
        setRecordingElapsedMs(getRecordingElapsedMs());
        setRecordedActions(
          enrichWorkflowSendDisplayFields([...getSessionEvents()], { getState: store.getState })
        );
        setPayloadEditIndex(playheadIndex);
        return;
      }
      if (getIsPlaying() || playbackWorkflowId == null) {
        return;
      }
      const currentActions = getPlaybackActions();
      if (index < 0 || index >= currentActions.length) {
        return;
      }
      seekPlaybackTo(index);
      setPlaybackTick((tick) => tick + 1);
      setPayloadEditIndex(index);
    },
    [editable, isRecordMode, playbackWorkflowId, store]
  );

  /**
   * Closes the payload JSON editor without applying draft changes.
   */
  const handleClosePayloadEditor = useCallback((): void => {
    setPayloadEditIndex(null);
  }, []);

  /**
   * Applies a parsed payload to the open timeline action and marks the buffer dirty.
   *
   * @param payload - Parsed JSON value for the action payload.
   */
  const handleUpdatePayload = useCallback(
    (payload: unknown): void => {
      if (payloadEditIndex == null) {
        return;
      }
      if (isRecordMode) {
        if (getIsRecording()) {
          return;
        }
        const nextActions = updateWorkflowActionPayloadAt(
          getSessionEvents(),
          payloadEditIndex,
          payload
        );
        if (nextActions == null) {
          return;
        }
        applyRecordEdit(nextActions, payloadEditIndex);
        setPayloadEditIndex(null);
        return;
      }
      if (playbackWorkflowId == null) {
        return;
      }
      const nextActions = updateWorkflowActionPayloadAt(
        getPlaybackActions(),
        payloadEditIndex,
        payload
      );
      if (nextActions == null) {
        return;
      }
      applyLocalEdit(nextActions, payloadEditIndex);
      setPayloadEditIndex(null);
    },
    [applyLocalEdit, applyRecordEdit, isRecordMode, payloadEditIndex, playbackWorkflowId]
  );

  /**
   * Persists the current playback buffer when there are unsaved edits.
   *
   * When edit was entered from play, a successful save returns the panel to play mode.
   */
  const handleSaveWorkflowEdits = useCallback(async (): Promise<void> => {
    if (playbackWorkflowId == null || !dirty || savingRef.current || getIsPlaying()) {
      return;
    }

    savingRef.current = true;
    setSaving(true);
    const actions = [...getPlaybackActions()];
    const durationMs = actions.length === 0 ? 0 : (playbackWorkflow?.durationMs ?? 0);

    try {
      await dispatch(
        updateWorkflowActions({
          id: playbackWorkflowId,
          actions,
          durationMs,
          delayMs: getPlaybackDelayMs()
        })
      ).unwrap();
      setDirty(false);
      if (editEnteredFromPlay) {
        dispatch(openWorkflowPlayDialog(playbackWorkflowId));
      }
    } catch (error) {
      showAlert(dispatch, formatErrorMessage(error, 'Failed to update workflow'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [dirty, dispatch, editEnteredFromPlay, playbackWorkflow?.durationMs, playbackWorkflowId]);

  /**
   * Discards edit-from-play changes (after confirm when dirty) and returns to play.
   */
  const handleCancelEditFromPlay = useCallback(async (): Promise<void> => {
    if (!editEnteredFromPlay || playbackWorkflowId == null || getIsPlaying() || savingRef.current) {
      return;
    }

    if (dirty) {
      const confirmed = await confirm({
        title: 'Discard unsaved changes?',
        message: 'Return to play without saving? Timeline edits will be lost.',
        confirmLabel: 'Discard',
        variant: 'danger'
      });
      if (!confirmed) {
        return;
      }
    }

    setDirty(false);
    setPayloadEditIndex(null);
    dispatch(openWorkflowPlayDialog(playbackWorkflowId));
  }, [confirm, dirty, dispatch, editEnteredFromPlay, playbackWorkflowId]);

  /**
   * Moves the active (or explicitly targeted) action ahead or behind its neighbor.
   *
   * @param direction - Timeline move direction.
   * @param indexOverride - Optional index from the context menu; defaults to the cursor.
   */
  const handleMoveAction = useCallback(
    (direction: WorkflowActionMoveDirection, indexOverride?: number): void => {
      if (!editable) {
        return;
      }
      if (isRecordMode) {
        if (getIsRecording()) {
          return;
        }
        const currentActions = getSessionEvents();
        const index = indexOverride ?? recordSelectedIndex;
        if (!canMoveWorkflowAction(index, currentActions.length, direction)) {
          return;
        }
        const nextActions = swapWorkflowActions(currentActions, index, direction);
        if (nextActions == null) {
          return;
        }
        applyRecordEdit(nextActions, cursorAfterMove(index, direction));
        return;
      }
      if (getIsPlaying() || playbackWorkflowId == null) {
        return;
      }
      const currentActions = getPlaybackActions();
      const index = indexOverride ?? getPlaybackIndex();
      if (!canMoveWorkflowAction(index, currentActions.length, direction)) {
        return;
      }
      const nextActions = swapWorkflowActions(currentActions, index, direction);
      if (nextActions == null) {
        return;
      }
      applyLocalEdit(nextActions, cursorAfterMove(index, direction));
    },
    [
      applyLocalEdit,
      applyRecordEdit,
      editable,
      isRecordMode,
      playbackWorkflowId,
      recordSelectedIndex
    ]
  );

  /**
   * Prompts to delete the active (or explicitly targeted) action locally.
   *
   * @param indexOverride - Optional index from the context menu or payload modal;
   *   defaults to the cursor.
   * @returns True when the action was removed from the local buffer.
   */
  const handleDeleteAction = useCallback(
    async (indexOverride?: number): Promise<boolean> => {
      if (!editable) {
        return false;
      }
      if (isRecordMode) {
        if (getIsRecording()) {
          return false;
        }
        const currentActions = getSessionEvents();
        const index = indexOverride ?? recordSelectedIndex;
        if (index < 0 || index >= currentActions.length) {
          return false;
        }
        const action = currentActions[index];
        if (action == null) {
          return false;
        }
        const described = describeWorkflowAction(action, {
          selected: true,
          compact: false,
          getState: store.getState
        });
        const confirmed = await confirm({
          title: 'Delete action?',
          message: `Delete “${described.title}” from this recording?`,
          confirmLabel: 'Delete',
          variant: 'danger'
        });
        if (!confirmed) {
          return false;
        }
        const nextActions = deleteWorkflowActionAt(currentActions, index);
        if (nextActions == null) {
          return false;
        }
        applyRecordEdit(
          nextActions,
          cursorAfterDelete(recordSelectedIndex, index, nextActions.length)
        );
        return true;
      }
      if (getIsPlaying() || playbackWorkflowId == null) {
        return false;
      }
      const currentActions = getPlaybackActions();
      const index = indexOverride ?? getPlaybackIndex();
      if (index < 0 || index >= currentActions.length) {
        return false;
      }
      const action = currentActions[index];
      if (action == null) {
        return false;
      }
      const described = describeWorkflowAction(action, {
        selected: true,
        compact: false,
        getState: store.getState
      });
      const confirmed = await confirm({
        title: 'Delete action?',
        message: `Delete “${described.title}” from this workflow?`,
        confirmLabel: 'Delete',
        variant: 'danger'
      });
      if (!confirmed) {
        return false;
      }
      const nextActions = deleteWorkflowActionAt(currentActions, index);
      if (nextActions == null) {
        return false;
      }
      const nextIndex = cursorAfterDelete(getPlaybackIndex(), index, nextActions.length);
      applyLocalEdit(nextActions, nextIndex);
      return true;
    },
    [
      applyLocalEdit,
      applyRecordEdit,
      confirm,
      editable,
      isRecordMode,
      playbackWorkflowId,
      recordSelectedIndex,
      store
    ]
  );

  /**
   * Deletes the action open in the payload editor and closes the modal on success.
   */
  const handleDeletePayloadAction = useCallback(async (): Promise<void> => {
    if (payloadEditIndex == null) {
      return;
    }
    const deleted = await handleDeleteAction(payloadEditIndex);
    if (deleted) {
      setPayloadEditIndex(null);
    }
  }, [handleDeleteAction, payloadEditIndex]);

  /**
   * Wires the configured save shortcut while edit mode is open and dirty.
   */
  useEffect(() => {
    if (dialogMode !== 'edit') {
      return;
    }

    /**
     * Saves when the configured save shortcut is pressed and the buffer is dirty.
     *
     * @param event - Keydown event from the document.
     */
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!acceleratorMatchesChord(saveAccelerator, chordFromKeyboardEvent(event))) {
        return;
      }

      if (!dirty || savingRef.current || getIsPlaying()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void handleSaveWorkflowEdits();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dialogMode, dirty, handleSaveWorkflowEdits, saveAccelerator]);

  /**
   * Closes the panel, confirming discard when unsaved recording or timeline edits exist.
   *
   * @returns True when the panel closed; false when the user cancelled.
   */
  const handleClose = useCallback(async (): Promise<boolean> => {
    if (!open) {
      return true;
    }

    if (isEditMode) {
      if (dirty) {
        const confirmed = await confirm({
          title: 'Discard unsaved changes?',
          message: 'Close without saving? Timeline edits will be lost.',
          confirmLabel: 'Discard',
          variant: 'danger'
        });
        if (!confirmed) {
          return false;
        }
      }
      stopPlayback();
      clearPlayback();
      setDirty(false);
      setPayloadEditIndex(null);
      dispatch(closeWorkflowDialog());
      return true;
    }

    if (isPlayMode) {
      stopPlayback();
      clearPlayback();
      dispatch(closeWorkflowDialog());
      return true;
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
        return false;
      }
    }
    clearSession();
    dispatch(closeWorkflowDialog());
    return true;
  }, [confirm, dirty, dispatch, isEditMode, isPlayMode, open]);

  /**
   * Persists dialog position after a drag.
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
   * Persists dialog size after a resize.
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

  if (!open || panelMode == null) {
    return null;
  }

  const runComplete =
    isPlayMode && !playing && playbackIndex >= playbackActionCount && playbackActionCount > 0;
  const payloadSourceActions = isRecordMode ? recordedActions : playbackActionsList;
  const payloadEditAction =
    editable &&
    payloadEditIndex != null &&
    payloadEditIndex >= 0 &&
    payloadEditIndex < payloadSourceActions.length
      ? payloadSourceActions[payloadEditIndex]
      : null;

  /**
   * Title node for the FloatingDialog drag handle (inline rename when a workflow is loaded).
   */
  const titleNode =
    playbackWorkflowId != null && playbackWorkflow != null ? (
      <WorkflowPlayDialogTitle
        workflowId={playbackWorkflowId}
        name={playbackWorkflow.name}
        titleId={titleId}
      />
    ) : (
      <h2 id={titleId} className="truncate text-[15px] font-semibold">
        {isRecordMode
          ? 'Untitled workflow'
          : (playbackWorkflow?.name ?? (isPlayMode ? 'Play workflow' : 'Workflow'))}
      </h2>
    );

  /**
   * Duration subtitle under the title.
   */
  const descriptionNode = (
    <p className="truncate text-[14px] text-muted">
      {isRecordMode
        ? `${formatWorkflowDuration(recordingElapsedMs)} recorded`
        : `${formatWorkflowDuration(playbackWorkflow?.durationMs ?? 0)} recorded`}
    </p>
  );

  const dialogLabel =
    playbackWorkflow?.name ??
    (isRecordMode ? 'Untitled workflow' : isPlayMode ? 'Play workflow' : 'Workflow');

  return (
    <>
      <FloatingDialog
        label={dialogLabel}
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
              {titleNode}
              {descriptionNode}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isRecordMode ? (
                <Button
                  type="button"
                  variant={recordedActions.length > 0 ? 'primarySuccess' : 'secondary'}
                  className="shrink-0"
                  disabled={recordedActions.length === 0}
                  onClick={handleSaveRecording}
                  aria-label="Save recording"
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <FaIcon icon={faFloppyDisk} className="h-3.5 w-3.5" aria-hidden />
                    Save
                  </span>
                </Button>
              ) : null}
              <button
                type="button"
                className="cursor-pointer rounded p-1 text-muted hover:bg-surface-raised hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                aria-label="Close workflow dialog"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleClose();
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <FaIcon icon={faXmark} className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <WorkflowPlaybackControls
              playing={timelineBusy}
              actionIndex={timelineSelectedIndex}
              actionCount={timelineActions.length}
              delayMs={delayMs}
              onTogglePlay={isRecordMode ? handleToggleRecord : handleTogglePlay}
              onRewind={handleRewind}
              onFastForward={handleFastForward}
              onRestart={handleRestart}
              onDelayMsChange={handleDelayMsChange}
              recordMode={isRecordMode}
            />
            <WorkflowEditControls
              playing={timelineBusy}
              dirty={dirty}
              saving={saving}
              showHostEditButtons={isEditMode}
              showCancel={editEnteredFromPlay}
              toolbarContext={{
                workflowId: playbackWorkflowId ?? -1,
                mode: pluginMode,
                actionIndex: timelineSelectedIndex,
                action:
                  timelineSelectedIndex >= 0 && timelineSelectedIndex < timelineActions.length
                    ? {
                        uuid: timelineActions[timelineSelectedIndex]!.uuid,
                        type: timelineActions[timelineSelectedIndex]!.type,
                        ...(timelineActions[timelineSelectedIndex]!.at != null
                          ? { at: timelineActions[timelineSelectedIndex]!.at }
                          : {}),
                        payload: timelineActions[timelineSelectedIndex]!.payload
                      }
                    : null,
                dirty
              }}
              onSave={() => {
                void handleSaveWorkflowEdits();
              }}
              onCancel={() => {
                void handleCancelEditFromPlay();
              }}
            />
            {isPlayMode ? (
              <>
                <Button
                  type="button"
                  variant="primarySuccess"
                  className="shrink-0"
                  disabled={!runComplete}
                  aria-label="Results"
                  onClick={handleOpenResults}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <FaIcon icon={faList} className="h-3.5 w-3.5" aria-hidden />
                    Results
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  disabled={!hasRunLog || playing}
                  aria-label="Reset results"
                  onClick={handleResetResults}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <FaIcon icon={faEraser} className="h-3.5 w-3.5" aria-hidden />
                    Reset
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  disabled={playing}
                  aria-label="Edit workflow"
                  onClick={handleEnterEditFromPlay}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <FaIcon icon={faPenToSquare} className="h-3.5 w-3.5" aria-hidden />
                    Edit
                  </span>
                </Button>
              </>
            ) : null}
          </div>
          {!isRecordMode ? (
            <>
              <p
                className="font-mono text-[15px] tabular-nums"
                aria-live="polite"
                aria-label="Playback elapsed time"
              >
                {formatWorkflowDuration(playbackElapsedMs)}
                <span className="text-muted">
                  {' '}
                  / {formatWorkflowDuration(playbackWorkflow?.durationMs ?? 0)}
                </span>
              </p>
              <label htmlFor={gaplessId} className="inline-flex items-center gap-2 text-[14px]">
                <Switch
                  id={gaplessId}
                  checked={gapless}
                  title={
                    gapless
                      ? 'Playing actions back-to-back (recorded waits skipped)'
                      : 'Waiting for recorded gaps between actions'
                  }
                  onChange={(event) => {
                    handleGaplessChange(event.target.checked);
                  }}
                />
                Gapless
              </label>
            </>
          ) : (
            <p
              className="font-mono text-[15px] tabular-nums"
              aria-live="polite"
              aria-label="Recording elapsed time"
            >
              {formatWorkflowDuration(recordingElapsedMs)}
            </p>
          )}
        </div>
        <WorkflowTimeline
          workflowId={playbackWorkflowId ?? -1}
          mode={pluginMode}
          actions={timelineActions}
          durationMs={timelineDurationMs}
          selectedIndex={timelineSelectedIndex}
          playheadMs={timelinePlayheadMs}
          playing={timelineBusy}
          editable={editable}
          gapless={gapless}
          delayMs={delayMs}
          getState={store.getState}
          runLogByActionUuid={runLogByActionUuid}
          onSeek={handleSeek}
          onMoveAhead={(index) => {
            handleMoveAction('ahead', index);
          }}
          onMoveBehind={(index) => {
            handleMoveAction('behind', index);
          }}
          onDelete={(index) => {
            void handleDeleteAction(index);
          }}
          onEditPayload={handleEditPayload}
        />
      </FloatingDialog>
      {payloadEditAction != null && payloadEditIndex != null ? (
        <WorkflowActionPayloadModal
          key={`payload-edit-${payloadEditIndex}`}
          action={payloadEditAction}
          onClose={handleClosePayloadEditor}
          onUpdate={handleUpdatePayload}
          onDelete={() => {
            void handleDeletePayloadAction();
          }}
        />
      ) : null}
    </>
  );
}
