import { describe, expect, it, vi } from 'vitest';
import {
  type SelectionActionToolbarState,
  applySelectionActionToolbarUpdate,
  buildSelectionActionToolbarState,
  computeSelectionActionToolbarCoords,
  createSelectionActionToolbarController,
  finalizeSelectionActionToolbarOnPointerUp
} from './selectionActionToolbar.js';

/**
 * Builds a minimal EditorView-like object for toolbar helper tests.
 *
 * @param options - Document text, selection offsets, and optional coordsAtPos behavior.
 * @returns A pick of EditorView fields used by the toolbar helpers.
 */
function createMockView(options: {
  doc: string;
  from: number;
  to: number;
  coordsAtPos?: (
    pos: number
  ) => { top: number; left: number; right: number; bottom: number } | null;
}): {
  coordsAtPos: (pos: number) => { top: number; left: number; right: number; bottom: number } | null;
  state: {
    selection: { main: { from: number; to: number } };
    sliceDoc: (from: number, to: number) => string;
  };
} {
  return {
    coordsAtPos:
      options.coordsAtPos ??
      ((pos: number) => ({
        top: 40,
        left: 100 + pos,
        right: 108 + pos,
        bottom: 56
      })),
    state: {
      selection: { main: { from: options.from, to: options.to } },
      sliceDoc: (from: number, to: number) => options.doc.slice(from, to)
    }
  };
}

/**
 * Builds a SelectionActionToolbarState fixture for controller tests.
 *
 * @param overrides - Partial fields to merge onto defaults.
 * @returns A complete toolbar snapshot.
 */
function createToolbarState(
  overrides: Partial<SelectionActionToolbarState> = {}
): SelectionActionToolbarState {
  return {
    top: 40,
    left: 120,
    text: 'hello',
    from: 0,
    to: 5,
    ...overrides
  };
}

describe('computeSelectionActionToolbarCoords', () => {
  it('returns the midpoint between selection start and end', () => {
    const view = createMockView({
      doc: 'hello world',
      from: 0,
      to: 5,
      coordsAtPos: (pos) => {
        if (pos === 0) {
          return { top: 10, left: 100, right: 108, bottom: 26 };
        }
        if (pos === 5) {
          return { top: 10, left: 200, right: 208, bottom: 26 };
        }
        return null;
      }
    });

    expect(computeSelectionActionToolbarCoords(view, 0, 5)).toEqual({
      top: 10,
      left: (104 + 204) / 2
    });
  });

  it('returns null when start coords are unavailable', () => {
    const view = createMockView({
      doc: 'hello',
      from: 0,
      to: 5,
      coordsAtPos: () => null
    });

    expect(computeSelectionActionToolbarCoords(view, 0, 5)).toBeNull();
  });

  it('falls back to the start center when end coords are missing', () => {
    const view = createMockView({
      doc: 'hello',
      from: 0,
      to: 5,
      coordsAtPos: (pos) => {
        if (pos === 0) {
          return { top: 12, left: 50, right: 58, bottom: 28 };
        }
        return null;
      }
    });

    expect(computeSelectionActionToolbarCoords(view, 0, 5)).toEqual({
      top: 12,
      left: 54
    });
  });
});

describe('buildSelectionActionToolbarState', () => {
  it('returns null for a collapsed selection', () => {
    const view = createMockView({ doc: 'hello', from: 2, to: 2 });
    expect(buildSelectionActionToolbarState(view)).toBeNull();
  });

  it('returns null for whitespace-only selections', () => {
    const view = createMockView({ doc: '  \n', from: 0, to: 3 });
    expect(buildSelectionActionToolbarState(view)).toBeNull();
  });

  it('returns a snapshot for a usable selection', () => {
    const view = createMockView({ doc: 'hello', from: 0, to: 5 });
    expect(buildSelectionActionToolbarState(view)).toEqual({
      top: 40,
      left: (104 + 109) / 2,
      text: 'hello',
      from: 0,
      to: 5
    });
  });
});

describe('applySelectionActionToolbarUpdate', () => {
  it('does not dismiss when selection collapses during a pointer drag', () => {
    const controller = createSelectionActionToolbarController();
    controller.isPointerSelecting = true;
    controller.lastNonEmptySelection = createToolbarState();
    controller.pendingState = createToolbarState();

    const dismissToolbar = vi.fn();
    const scheduleShow = vi.fn();
    const showImmediately = vi.fn();
    const notifyToolbarChange = vi.fn();
    const clearShowTimer = vi.fn();

    const view = createMockView({ doc: 'hello', from: 0, to: 0 });
    applySelectionActionToolbarUpdate(
      controller,
      {
        selectionSet: true,
        docChanged: false,
        viewportChanged: false,
        view,
        state: view.state
      },
      {
        isEnabled: () => true,
        isOpen: () => false,
        notifyToolbarChange,
        clearShowTimer,
        scheduleShow,
        showImmediately,
        dismissToolbar
      }
    );

    expect(dismissToolbar).not.toHaveBeenCalled();
    expect(controller.lastNonEmptySelection).toEqual(createToolbarState());
  });

  it('caches the last non-empty selection while dragging', () => {
    const controller = createSelectionActionToolbarController();
    controller.isPointerSelecting = true;

    const scheduleShow = vi.fn();
    const view = createMockView({ doc: 'hello', from: 0, to: 5 });

    applySelectionActionToolbarUpdate(
      controller,
      {
        selectionSet: true,
        docChanged: false,
        viewportChanged: false,
        view,
        state: view.state
      },
      {
        isEnabled: () => true,
        isOpen: () => false,
        notifyToolbarChange: vi.fn(),
        clearShowTimer: vi.fn(),
        scheduleShow,
        showImmediately: vi.fn(),
        dismissToolbar: vi.fn()
      }
    );

    expect(controller.lastNonEmptySelection).toEqual({
      top: 40,
      left: (104 + 109) / 2,
      text: 'hello',
      from: 0,
      to: 5
    });
    expect(scheduleShow).toHaveBeenCalledOnce();
  });

  it('consumes suppressCollapseDismiss on the first collapsed update without dismissing', () => {
    const controller = createSelectionActionToolbarController();
    controller.suppressCollapseDismiss = true;
    controller.isToolbarOpen = true;

    const dismissToolbar = vi.fn();
    const view = createMockView({ doc: 'hello', from: 1, to: 1 });

    applySelectionActionToolbarUpdate(
      controller,
      {
        selectionSet: true,
        docChanged: false,
        viewportChanged: false,
        view,
        state: view.state
      },
      {
        isEnabled: () => true,
        isOpen: () => true,
        notifyToolbarChange: vi.fn(),
        clearShowTimer: vi.fn(),
        scheduleShow: vi.fn(),
        showImmediately: vi.fn(),
        dismissToolbar
      }
    );

    expect(dismissToolbar).not.toHaveBeenCalled();
    expect(controller.suppressCollapseDismiss).toBe(false);
  });

  it('dismisses on a second collapsed update after suppressCollapseDismiss was consumed', () => {
    const controller = createSelectionActionToolbarController();
    controller.suppressCollapseDismiss = true;
    controller.isToolbarOpen = true;

    const dismissToolbar = vi.fn();
    const view = createMockView({ doc: 'hello', from: 1, to: 1 });
    const options = {
      isEnabled: () => true,
      isOpen: () => true,
      notifyToolbarChange: vi.fn(),
      clearShowTimer: vi.fn(),
      scheduleShow: vi.fn(),
      showImmediately: vi.fn(),
      dismissToolbar
    };
    const collapsedUpdate = {
      selectionSet: true,
      docChanged: false,
      viewportChanged: false,
      view,
      state: view.state
    };

    applySelectionActionToolbarUpdate(controller, collapsedUpdate, options);
    applySelectionActionToolbarUpdate(controller, collapsedUpdate, options);

    expect(dismissToolbar).toHaveBeenCalledOnce();
    expect(controller.suppressCollapseDismiss).toBe(false);
  });

  it('dismisses collapsed selection when not dragging and not suppressed', () => {
    const controller = createSelectionActionToolbarController();
    const dismissToolbar = vi.fn();
    const view = createMockView({ doc: 'hello', from: 1, to: 1 });

    applySelectionActionToolbarUpdate(
      controller,
      {
        selectionSet: true,
        docChanged: false,
        viewportChanged: false,
        view,
        state: view.state
      },
      {
        isEnabled: () => true,
        isOpen: () => false,
        notifyToolbarChange: vi.fn(),
        clearShowTimer: vi.fn(),
        scheduleShow: vi.fn(),
        showImmediately: vi.fn(),
        dismissToolbar
      }
    );

    expect(dismissToolbar).toHaveBeenCalledOnce();
  });

  it('dismisses after keyboard collapse following a drag-select finalize', () => {
    const controller = createSelectionActionToolbarController();
    controller.isPointerSelecting = true;
    controller.lastNonEmptySelection = createToolbarState();

    const dismissToolbar = vi.fn();
    const showImmediately = vi.fn();

    finalizeSelectionActionToolbarOnPointerUp(
      controller,
      createMockView({ doc: 'hello', from: 0, to: 0 }),
      {
        isOpen: () => false,
        scheduleShow: vi.fn(),
        showImmediately,
        dismissToolbar
      }
    );

    expect(showImmediately).toHaveBeenCalledOnce();
    expect(controller.suppressCollapseDismiss).toBe(true);

    const collapsedView = createMockView({ doc: 'hello', from: 3, to: 3 });
    const options = {
      isEnabled: () => true,
      isOpen: () => true,
      notifyToolbarChange: vi.fn(),
      clearShowTimer: vi.fn(),
      scheduleShow: vi.fn(),
      showImmediately: vi.fn(),
      dismissToolbar
    };
    const collapsedUpdate = {
      selectionSet: true,
      docChanged: false,
      viewportChanged: false,
      view: collapsedView,
      state: collapsedView.state
    };

    // Gutter race: first collapse is suppressed and consumes the one-shot flag.
    applySelectionActionToolbarUpdate(controller, collapsedUpdate, options);
    expect(dismissToolbar).not.toHaveBeenCalled();
    expect(controller.suppressCollapseDismiss).toBe(false);

    // Arrow-key collapse: toolbar must dismiss.
    applySelectionActionToolbarUpdate(controller, collapsedUpdate, options);
    expect(dismissToolbar).toHaveBeenCalledOnce();
  });
});

describe('finalizeSelectionActionToolbarOnPointerUp', () => {
  it('shows immediately from lastNonEmptySelection when the live selection collapsed', () => {
    const controller = createSelectionActionToolbarController();
    controller.isPointerSelecting = true;
    const cached = createToolbarState({ text: 'rtl-sel', from: 2, to: 7 });
    controller.lastNonEmptySelection = cached;

    const showImmediately = vi.fn();
    const scheduleShow = vi.fn();
    const collapsedView = createMockView({ doc: 'hello world', from: 2, to: 2 });

    finalizeSelectionActionToolbarOnPointerUp(controller, collapsedView, {
      isOpen: () => false,
      scheduleShow,
      showImmediately,
      dismissToolbar: vi.fn()
    });

    expect(showImmediately).toHaveBeenCalledWith(cached);
    expect(controller.lastNonEmptySelection).toBeNull();
    expect(controller.isPointerSelecting).toBe(false);
    expect(controller.suppressCollapseDismiss).toBe(true);
  });

  it('prefers the live non-empty selection over the cache', () => {
    const controller = createSelectionActionToolbarController();
    controller.isPointerSelecting = true;
    controller.lastNonEmptySelection = createToolbarState({ text: 'stale' });

    const showImmediately = vi.fn();
    const liveView = createMockView({ doc: 'hello', from: 0, to: 5 });

    finalizeSelectionActionToolbarOnPointerUp(controller, liveView, {
      isOpen: () => false,
      scheduleShow: vi.fn(),
      showImmediately,
      dismissToolbar: vi.fn()
    });

    expect(showImmediately).toHaveBeenCalledWith({
      top: 40,
      left: (104 + 109) / 2,
      text: 'hello',
      from: 0,
      to: 5
    });
  });

  it('is idempotent when finalize runs twice', () => {
    const controller = createSelectionActionToolbarController();
    controller.isPointerSelecting = true;
    controller.lastNonEmptySelection = createToolbarState();

    const showImmediately = vi.fn();
    const view = createMockView({ doc: 'hello', from: 0, to: 0 });

    finalizeSelectionActionToolbarOnPointerUp(controller, view, {
      isOpen: () => false,
      scheduleShow: vi.fn(),
      showImmediately,
      dismissToolbar: vi.fn()
    });
    finalizeSelectionActionToolbarOnPointerUp(controller, view, {
      isOpen: () => false,
      scheduleShow: vi.fn(),
      showImmediately,
      dismissToolbar: vi.fn()
    });

    expect(showImmediately).toHaveBeenCalledOnce();
    expect(controller.suppressCollapseDismiss).toBe(true);
  });

  it('dismisses when pointerup has no live selection and no cached snapshot', () => {
    const controller = createSelectionActionToolbarController();
    controller.isPointerSelecting = true;
    controller.isToolbarOpen = true;
    controller.lastNonEmptySelection = null;

    const dismissToolbar = vi.fn(() => {
      controller.suppressCollapseDismiss = false;
    });
    const showImmediately = vi.fn();
    const view = createMockView({ doc: 'hello', from: 2, to: 2 });

    finalizeSelectionActionToolbarOnPointerUp(controller, view, {
      isOpen: () => true,
      scheduleShow: vi.fn(),
      showImmediately,
      dismissToolbar
    });

    expect(showImmediately).not.toHaveBeenCalled();
    expect(dismissToolbar).toHaveBeenCalledOnce();
    expect(controller.suppressCollapseDismiss).toBe(false);
    expect(controller.isPointerSelecting).toBe(false);
  });
});
