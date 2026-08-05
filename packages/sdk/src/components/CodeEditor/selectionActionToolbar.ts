import type { Extension } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';

/** Delay before showing the selection action toolbar after selection settles. */
export const SELECTION_TOOLBAR_SHOW_DELAY_MS = 450;

/**
 * Snapshot of a non-empty text selection used to position and drive the toolbar.
 */
export interface SelectionActionToolbarState {
  /**
   * Viewport Y of the selection start (toolbar anchors above this).
   */
  top: number;

  /**
   * Viewport X midpoint between selection start and end.
   */
  left: number;

  /**
   * Selected document text.
   */
  text: string;

  /**
   * Start offset (inclusive) in the document.
   */
  from: number;

  /**
   * End offset (exclusive) in the document.
   */
  to: number;
}

/**
 * Shared debounce and pointer-drag state for the selection action toolbar.
 */
export interface SelectionActionToolbarController {
  showTimer: ReturnType<typeof setTimeout> | undefined;
  isPointerSelecting: boolean;
  isToolbarOpen: boolean;
  pendingState: SelectionActionToolbarState | null;
  /**
   * Last non-empty selection seen during a pointer drag. Survives gutter-induced
   * collapse so the toolbar can still appear after RTL drag-select into the gutter.
   */
  lastNonEmptySelection: SelectionActionToolbarState | null;
  /**
   * One-shot shield: ignore the next collapsed/unusable selection dismissal that
   * races pointerup (CodeMirror may collapse into the gutter in the same event
   * turn). Cleared after it is consumed, when the toolbar hides, or on the next
   * pointerdown.
   */
  suppressCollapseDismiss: boolean;
}

/**
 * Rect returned by {@link EditorView.coordsAtPos} (or a test double).
 */
export interface SelectionToolbarCoords {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

/**
 * Minimal view surface used by toolbar helpers so unit tests can supply doubles
 * without constructing a full CodeMirror {@link EditorView}.
 */
export interface SelectionToolbarViewLike {
  /**
   * Resolves viewport coordinates for a document offset.
   *
   * @param pos - Document offset.
   * @returns Screen rect, or null when the position is not measurable.
   */
  coordsAtPos: (pos: number) => SelectionToolbarCoords | null;

  /**
   * Document selection and slice accessors.
   */
  state: {
    selection: { main: { from: number; to: number } };
    sliceDoc: (from: number, to: number) => string;
  };
}

/**
 * Minimal view-update surface used by {@link applySelectionActionToolbarUpdate}.
 */
export interface SelectionToolbarUpdateLike {
  selectionSet: boolean;
  docChanged: boolean;
  viewportChanged: boolean;
  view: SelectionToolbarViewLike;
  state: SelectionToolbarViewLike['state'];
}

/**
 * Computes viewport anchor coordinates for the selection action toolbar.
 *
 * @param view - CodeMirror editor view (or test double).
 * @param selectionFrom - Start offset (inclusive) of the selection.
 * @param selectionTo - End offset (exclusive) of the selection.
 * @returns Toolbar anchor position, or null when coords are unavailable.
 */
export function computeSelectionActionToolbarCoords(
  view: Pick<SelectionToolbarViewLike, 'coordsAtPos'>,
  selectionFrom: number,
  selectionTo: number
): { top: number; left: number } | null {
  const startCoords = view.coordsAtPos(selectionFrom);
  if (!startCoords) {
    return null;
  }

  const endCoords = view.coordsAtPos(selectionTo);
  const startCenter = startCoords.left + (startCoords.right - startCoords.left) / 2;
  const endCenter = endCoords
    ? endCoords.left + (endCoords.right - endCoords.left) / 2
    : startCenter;

  return {
    top: startCoords.top,
    left: (startCenter + endCenter) / 2
  };
}

/**
 * Builds a toolbar snapshot from the current editor selection when it is usable.
 *
 * @param view - CodeMirror editor view (or test double).
 * @returns Toolbar state, or null when the selection is empty, whitespace-only, or coords fail.
 */
export function buildSelectionActionToolbarState(
  view: SelectionToolbarViewLike
): SelectionActionToolbarState | null {
  const { from, to } = view.state.selection.main;
  if (from === to) {
    return null;
  }

  const selectionFrom = Math.min(from, to);
  const selectionTo = Math.max(from, to);
  const text = view.state.sliceDoc(selectionFrom, selectionTo);
  if (!text.trim()) {
    return null;
  }

  const coords = computeSelectionActionToolbarCoords(view, selectionFrom, selectionTo);
  if (!coords) {
    return null;
  }

  return {
    top: coords.top,
    left: coords.left,
    text,
    from: selectionFrom,
    to: selectionTo
  };
}

/**
 * Creates a fresh controller used by the selection toolbar extensions and unit tests.
 *
 * @returns Mutable controller state for pointer-drag and debounce bookkeeping.
 */
export function createSelectionActionToolbarController(): SelectionActionToolbarController {
  return {
    showTimer: undefined,
    isPointerSelecting: false,
    isToolbarOpen: false,
    pendingState: null,
    lastNonEmptySelection: null,
    suppressCollapseDismiss: false
  };
}

/**
 * Returns whether a collapsed or unusable selection should skip dismissal.
 *
 * During a pointer drag, collapses are ignored so RTL gutter releases can still
 * finalize. Immediately after pointerup, {@link SelectionActionToolbarController.suppressCollapseDismiss}
 * is a one-shot shield for the gutter race; it is consumed here so later collapses
 * (arrow keys, typing, clicks) dismiss the toolbar normally.
 *
 * @param controller - Shared toolbar controller.
 * @returns True when this update should not dismiss the toolbar.
 */
function shouldSuppressCollapseDismiss(controller: SelectionActionToolbarController): boolean {
  if (controller.isPointerSelecting) {
    return true;
  }

  if (controller.suppressCollapseDismiss) {
    controller.suppressCollapseDismiss = false;
    return true;
  }

  return false;
}

/**
 * Applies a view update to the selection toolbar controller.
 *
 * Encodes the RTL-gutter fix: collapsed selections during a pointer drag do not
 * dismiss a previously captured selection. A one-shot post-pointerup shield
 * ignores a single gutter-induced collapse, then later collapses dismiss normally.
 *
 * @param controller - Shared toolbar controller.
 * @param update - CodeMirror view update.
 * @param options - Enable/open callbacks and notify/dismiss helpers.
 */
export function applySelectionActionToolbarUpdate(
  controller: SelectionActionToolbarController,
  update: SelectionToolbarUpdateLike,
  options: {
    isEnabled: () => boolean;
    isOpen: () => boolean;
    notifyToolbarChange: (state: SelectionActionToolbarState | null) => void;
    clearShowTimer: () => void;
    scheduleShow: (state: SelectionActionToolbarState) => void;
    showImmediately: (state: SelectionActionToolbarState) => void;
    dismissToolbar: () => void;
  }
): void {
  if (!options.isEnabled()) {
    options.dismissToolbar();
    return;
  }

  if (!update.selectionSet && !update.docChanged && !update.viewportChanged) {
    return;
  }

  const { from, to } = update.state.selection.main;
  if (from === to) {
    // During drag or on the one-shot post-pointerup race, CodeMirror may collapse
    // into the gutter; keep the last non-empty selection for finalize.
    if (shouldSuppressCollapseDismiss(controller)) {
      return;
    }
    options.dismissToolbar();
    return;
  }

  const nextState = buildSelectionActionToolbarState(update.view);
  if (!nextState) {
    if (shouldSuppressCollapseDismiss(controller)) {
      return;
    }
    options.dismissToolbar();
    return;
  }

  if (controller.isPointerSelecting) {
    controller.lastNonEmptySelection = nextState;
  }

  if (options.isOpen() && !update.selectionSet && update.viewportChanged) {
    options.showImmediately(nextState);
    return;
  }

  if (options.isOpen() && update.selectionSet) {
    options.scheduleShow(nextState);
    return;
  }

  options.scheduleShow(nextState);
}

/**
 * Finalizes the toolbar after a primary-button pointer drag ends.
 *
 * Prefers the live selection; falls back to {@link SelectionActionToolbarController.lastNonEmptySelection}
 * so RTL releases into the gutter still reveal Copy to chat. When neither yields a
 * snapshot, dismisses any open or pending toolbar so a plain click collapses it.
 *
 * @param controller - Shared toolbar controller.
 * @param view - CodeMirror editor view at pointerup.
 * @param options - Open check, show, and dismiss helpers.
 */
export function finalizeSelectionActionToolbarOnPointerUp(
  controller: SelectionActionToolbarController,
  view: SelectionToolbarViewLike,
  options: {
    isOpen: () => boolean;
    scheduleShow: (state: SelectionActionToolbarState) => void;
    showImmediately: (state: SelectionActionToolbarState) => void;
    dismissToolbar: () => void;
  }
): void {
  if (!controller.isPointerSelecting) {
    return;
  }

  controller.isPointerSelecting = false;
  const liveSnapshot = buildSelectionActionToolbarState(view);
  const snapshot = liveSnapshot ?? controller.lastNonEmptySelection;
  controller.lastNonEmptySelection = null;

  if (snapshot) {
    controller.suppressCollapseDismiss = true;
    options.showImmediately(snapshot);
    return;
  }

  if (controller.pendingState != null && !options.isOpen()) {
    options.scheduleShow(controller.pendingState);
    return;
  }

  options.dismissToolbar();
}

/**
 * Builds update and pointer handlers that debounce toolbar display until selection settles.
 *
 * @param onToolbarChange - React setter for toolbar visibility and position.
 * @param isEnabled - Whether selection actions are currently configured.
 * @param isOpen - Whether the toolbar is currently visible in React state.
 * @param onDismiss - Extra host cleanup when Escape dismisses the toolbar.
 * @returns CodeMirror extensions that drive the floating selection toolbar.
 */
export function createSelectionActionToolbarExtensions(
  onToolbarChange: (state: SelectionActionToolbarState | null) => void,
  isEnabled: () => boolean,
  isOpen: () => boolean,
  onDismiss: () => void
): Extension[] {
  const controller = createSelectionActionToolbarController();
  let activeView: EditorView | null = null;

  /**
   * Clears a scheduled toolbar reveal without changing open state.
   */
  const clearShowTimer = (): void => {
    if (controller.showTimer) {
      clearTimeout(controller.showTimer);
      controller.showTimer = undefined;
    }
  };

  /**
   * Notifies React of toolbar visibility while keeping controller state in sync.
   *
   * @param state - Next toolbar snapshot, or null to hide.
   */
  const notifyToolbarChange = (state: SelectionActionToolbarState | null): void => {
    controller.isToolbarOpen = state != null;
    if (state == null) {
      controller.pendingState = null;
      controller.suppressCollapseDismiss = false;
    }
    onToolbarChange(state);
  };

  /**
   * Hides the toolbar immediately and cancels any pending reveal.
   *
   * Does not clear {@link SelectionActionToolbarController.lastNonEmptySelection}
   * so a later pointerup can still recover an RTL gutter collapse. Clears
   * {@link SelectionActionToolbarController.suppressCollapseDismiss} so a closed
   * toolbar never starts out suppressed.
   */
  const dismissToolbar = (): void => {
    clearShowTimer();
    controller.suppressCollapseDismiss = false;
    if (controller.isToolbarOpen || controller.pendingState != null) {
      notifyToolbarChange(null);
    }
  };

  /**
   * Schedules toolbar display after the configured settle delay.
   *
   * @param state - Snapshot to show once the settle timer fires.
   */
  const scheduleShow = (state: SelectionActionToolbarState): void => {
    controller.pendingState = state;
    clearShowTimer();

    if (controller.isPointerSelecting) {
      return;
    }

    controller.showTimer = setTimeout(() => {
      controller.showTimer = undefined;
      if (controller.isPointerSelecting) {
        return;
      }
      notifyToolbarChange(state);
    }, SELECTION_TOOLBAR_SHOW_DELAY_MS);
  };

  /**
   * Repositions or reveals the toolbar without waiting when it is already open
   * or when pointerup finalizes a drag selection.
   *
   * @param state - Snapshot to show immediately.
   */
  const showImmediately = (state: SelectionActionToolbarState): void => {
    clearShowTimer();
    controller.pendingState = state;
    notifyToolbarChange(state);
  };

  /**
   * Finalizes an in-progress pointer drag using the last known editor view.
   */
  const finalizePointerSelection = (): void => {
    if (activeView == null) {
      return;
    }
    finalizeSelectionActionToolbarOnPointerUp(controller, activeView, {
      isOpen,
      scheduleShow,
      showImmediately,
      dismissToolbar
    });
  };

  if (typeof window !== 'undefined') {
    /**
     * Finalizes drag-select when pointerup lands in the gutter, which bypasses
     * CodeMirror domEventHandlers.
     */
    const handleWindowPointerUp = (): void => {
      if (!controller.isPointerSelecting) {
        return;
      }
      finalizePointerSelection();
    };
    window.addEventListener('pointerup', handleWindowPointerUp, true);
  }

  const updateListener = EditorView.updateListener.of((update) => {
    applySelectionActionToolbarUpdate(
      controller,
      {
        selectionSet: update.selectionSet,
        docChanged: update.docChanged,
        viewportChanged: update.viewportChanged,
        view: update.view,
        state: update.state
      },
      {
        isEnabled,
        isOpen,
        notifyToolbarChange,
        clearShowTimer,
        scheduleShow,
        showImmediately,
        dismissToolbar
      }
    );
  });

  const pointerGuard = EditorView.domEventHandlers({
    /**
     * Suppresses toolbar reveal while the user is drag-selecting with the primary button.
     *
     * @param event - Native pointerdown on the editor.
     */
    pointerdown(event, view) {
      if (event.button === 0) {
        activeView = view;
        controller.suppressCollapseDismiss = false;
        controller.isPointerSelecting = true;
        controller.lastNonEmptySelection = null;
        clearShowTimer();
      }
      return false;
    },
    /**
     * Finalizes the toolbar after drag-select completes, recovering gutter collapses.
     *
     * @param _event - Native pointerup on the editor.
     * @param view - CodeMirror view at release time.
     */
    pointerup(_event, view) {
      activeView = view;
      finalizePointerSelection();
      return false;
    }
  });

  const dismissHandler = EditorView.domEventHandlers({
    /**
     * Dismisses the open toolbar when Escape is pressed.
     *
     * @param event - Native keydown on the editor.
     */
    keydown(event) {
      if (event.key === 'Escape' && isOpen()) {
        event.preventDefault();
        dismissToolbar();
        onDismiss();
        return true;
      }
      return false;
    }
  });

  const cleanupPlugin = ViewPlugin.fromClass(
    class {
      /**
       * Clears any pending toolbar reveal when the editor extension is destroyed.
       */
      destroy(): void {
        clearShowTimer();
      }
    }
  );

  return [updateListener, pointerGuard, dismissHandler, cleanupPlugin];
}
