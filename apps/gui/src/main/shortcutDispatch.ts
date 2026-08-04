import { type BrowserWindow, type Input } from 'electron';
import { getShortcutOverrides } from '#/main/settings/shortcutSettings';
import { stepZoomIn, stepZoomOut, resetZoom } from '#/main/window/zoom';
import {
  acceleratorMatchesChord,
  resolveAcceleratorMap,
  SHORTCUT_DEFS,
  type KeyChord
} from '@harborclient/core/shortcuts';

/**
 * When true, action/zoom shortcut dispatch is skipped so focused renderer UI
 * (Shortcut Tutor) receives key events. Menu accelerators are cleared separately
 * when the application menu is rebuilt after this flag changes.
 */
let shortcutCapturePaused = false;

/**
 * Returns whether global shortcut capture is currently paused.
 *
 * @returns True when action/zoom dispatch should no-op.
 */
export function isShortcutCapturePaused(): boolean {
  return shortcutCapturePaused;
}

/**
 * Pauses or resumes matching of application keyboard shortcuts in the main process.
 *
 * Callers must rebuild the application menu after changing this so accelerators
 * are cleared or restored.
 *
 * @param paused - True to ignore shortcut chords until resumed.
 */
export function setShortcutCapturePaused(paused: boolean): void {
  shortcutCapturePaused = paused;
}

/**
 * Applies a matched zoom shortcut to the main renderer web contents.
 *
 * @param window - Main browser window whose UI should scale.
 * @param role - Zoom role from the shortcut registry.
 */
function dispatchZoomShortcut(
  window: BrowserWindow,
  role: 'zoomIn' | 'zoomOut' | 'resetZoom'
): void {
  if (role === 'zoomIn') {
    stepZoomIn(window.webContents);
    return;
  }

  if (role === 'zoomOut') {
    stepZoomOut(window.webContents);
    return;
  }

  resetZoom(window.webContents);
}

/**
 * Builds a key chord from an Electron before-input-event payload.
 *
 * @param input - Electron keyboard input event fields.
 * @returns Normalized chord for accelerator matching.
 */
function chordFromInput(input: Input): KeyChord {
  return {
    key: input.key,
    code: input.code,
    control: input.control,
    meta: input.meta,
    alt: input.alt,
    shift: input.shift
  };
}

/**
 * Matches a keydown against registered action shortcuts and sends `menu:action`
 * to the main renderer when one matches (e.g. Save / Ctrl+S).
 *
 * Used by both the shell webContents and browser guest views so accelerators
 * still reach HarborClient when the guest has focus.
 *
 * @param window - Main browser window whose renderer receives the menu action.
 * @param input - Electron before-input-event payload.
 * @returns True when an action shortcut matched and was dispatched.
 */
export function tryDispatchActionShortcut(window: BrowserWindow, input: Input): boolean {
  if (shortcutCapturePaused || input.type !== 'keyDown' || input.isAutoRepeat) {
    return false;
  }

  const chord = chordFromInput(input);
  const accelerators = resolveAcceleratorMap(getShortcutOverrides());

  for (const def of SHORTCUT_DEFS) {
    if (def.rendererOnly || def.kind !== 'action' || def.actionId == null) {
      continue;
    }

    const accelerator = accelerators.get(def.id);
    if (accelerator == null || accelerator.length === 0) {
      continue;
    }

    if (!acceleratorMatchesChord(accelerator, chord)) {
      continue;
    }

    window.webContents.send('menu:action', def.actionId);
    return true;
  }

  return false;
}

/**
 * Matches a keydown against zoom role shortcuts and applies them on the shell.
 *
 * @param window - Main browser window whose UI should scale.
 * @param input - Electron before-input-event payload.
 * @returns True when a zoom shortcut matched and was applied.
 */
function tryDispatchZoomShortcut(window: BrowserWindow, input: Input): boolean {
  if (shortcutCapturePaused || input.type !== 'keyDown' || input.isAutoRepeat) {
    return false;
  }

  const chord = chordFromInput(input);
  const accelerators = resolveAcceleratorMap(getShortcutOverrides());

  for (const def of SHORTCUT_DEFS) {
    if (
      def.kind !== 'role' ||
      (def.role !== 'zoomIn' && def.role !== 'zoomOut' && def.role !== 'resetZoom')
    ) {
      continue;
    }

    const accelerator = accelerators.get(def.id);
    if (accelerator == null || accelerator.length === 0) {
      continue;
    }

    if (!acceleratorMatchesChord(accelerator, chord)) {
      continue;
    }

    dispatchZoomShortcut(window, def.role);
    return true;
  }

  return false;
}

/**
 * Dispatches custom menu actions from keyboard input so accelerators work even
 * when they are not bound to a visible application menu item.
 *
 * @param window - Main browser window whose webContents receives key events.
 */
export function attachShortcutDispatch(window: BrowserWindow): void {
  window.webContents.on('before-input-event', (event, input) => {
    if (tryDispatchActionShortcut(window, input) || tryDispatchZoomShortcut(window, input)) {
      event.preventDefault();
    }
  });
}
