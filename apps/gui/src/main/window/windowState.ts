import { app, BrowserWindow, screen, type Display } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Persisted main-window bounds and presentation written to `window-state.json`.
 */
export interface SavedWindowState {
  /**
   * Left edge of the window in screen coordinates (normal bounds, not maximized size).
   */
  x: number;

  /**
   * Top edge of the window in screen coordinates (normal bounds, not maximized size).
   */
  y: number;

  /**
   * Window width in pixels before maximize or full-screen presentation is applied.
   */
  width: number;

  /**
   * Window height in pixels before maximize or full-screen presentation is applied.
   */
  height: number;

  /**
   * When true, the window is restored maximized after bounds are applied.
   */
  isMaximized: boolean;

  /**
   * When true, the window is restored full screen after bounds are applied.
   */
  isFullScreen: boolean;
}

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;
const SAVE_DEBOUNCE_MS = 200;
const PRESENTATION_RETRY_INTERVAL_MS = 100;
const PRESENTATION_RETRY_LIMIT = 20;

/**
 * Returns the path to the persisted window-state file.
 */
function getStatePath(): string {
  return join(app.getPath('userData'), 'window-state.json');
}

/**
 * Returns default window bounds when nothing valid is persisted.
 */
function defaultState(): SavedWindowState {
  return {
    x: 0,
    y: 0,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    isMaximized: false,
    isFullScreen: false
  };
}

/**
 * Type guard for persisted window state payloads.
 */
function isValidState(
  value: unknown
): value is Partial<SavedWindowState> & { width: number; height: number } {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<SavedWindowState>;
  return (
    typeof state.width === 'number' &&
    state.width > 0 &&
    typeof state.height === 'number' &&
    state.height > 0
  );
}

/**
 * Returns true when the window fits entirely inside a display work area.
 */
function fitsOnDisplay(state: SavedWindowState, displays: Display[]): boolean {
  return displays.some(
    ({ workArea }) =>
      state.x >= workArea.x &&
      state.y >= workArea.y &&
      state.x + state.width <= workArea.x + workArea.width &&
      state.y + state.height <= workArea.y + workArea.height
  );
}

/**
 * Picks the display whose work area contains the window center, falling back to the first.
 */
function nearestDisplay(state: SavedWindowState, displays: Display[]): Display {
  const centerX = state.x + state.width / 2;
  const centerY = state.y + state.height / 2;

  return (
    displays.find(
      ({ workArea }) =>
        centerX >= workArea.x &&
        centerX < workArea.x + workArea.width &&
        centerY >= workArea.y &&
        centerY < workArea.y + workArea.height
    ) ?? displays[0]
  );
}

/**
 * Repositions an off-screen window on the nearest display while keeping its size.
 */
export function fitWindowStateToDisplays(
  state: SavedWindowState,
  displays: Display[]
): SavedWindowState {
  if (displays.length === 0 || fitsOnDisplay(state, displays)) {
    return state;
  }

  const target = nearestDisplay(state, displays);
  const { workArea } = target;
  const width = Math.min(state.width, workArea.width);
  const height = Math.min(state.height, workArea.height);
  const x = workArea.x + Math.max(0, Math.floor((workArea.width - width) / 2));
  const y = workArea.y + Math.max(0, Math.floor((workArea.height - height) / 2));

  return {
    ...state,
    x,
    y,
    width,
    height,
    isMaximized: false,
    isFullScreen: false
  };
}

/**
 * Loads persisted main-window bounds.
 */
export function loadWindowState(): SavedWindowState {
  try {
    const parsed: unknown = JSON.parse(readFileSync(getStatePath(), 'utf8'));
    if (!isValidState(parsed)) return defaultState();

    const state: SavedWindowState = {
      x: typeof parsed.x === 'number' ? parsed.x : 0,
      y: typeof parsed.y === 'number' ? parsed.y : 0,
      width: parsed.width,
      height: parsed.height,
      isMaximized: parsed.isMaximized === true,
      isFullScreen: parsed.isFullScreen === true
    };

    return fitWindowStateToDisplays(state, screen.getAllDisplays());
  } catch {
    return defaultState();
  }
}

/**
 * Writes current BrowserWindow bounds to disk.
 */
export function saveWindowState(window: BrowserWindow): void {
  if (window.isDestroyed()) return;

  try {
    const isMaximized = window.isMaximized();
    const isFullScreen = window.isFullScreen();
    const bounds = isMaximized || isFullScreen ? window.getNormalBounds() : window.getBounds();

    const state: SavedWindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized,
      isFullScreen
    };

    mkdirSync(app.getPath('userData'), { recursive: true });
    writeFileSync(getStatePath(), JSON.stringify(state));
  } catch {
    // Best-effort persistence.
  }
}

/**
 * Restores maximized or full-screen presentation after the window is shown.
 *
 * Some Linux window managers honor `maximize()` / `setFullScreen()` only after
 * they finish mapping the window (a few hundred ms after `show()`), silently
 * dropping the first call. Re-assert until it takes effect, then stop.
 *
 * @param window - Main application window (already shown).
 * @param state - Persisted presentation to restore.
 */
export function restoreWindowPresentation(window: BrowserWindow, state: SavedWindowState): void {
  if (!state.isMaximized && !state.isFullScreen) return;

  const apply = (): void => {
    if (state.isFullScreen) {
      window.setFullScreen(true);
    } else {
      window.maximize();
    }
  };

  const applied = (): boolean =>
    state.isFullScreen ? window.isFullScreen() : window.isMaximized();

  apply();
  if (applied()) return;

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (window.isDestroyed() || applied() || attempts >= PRESENTATION_RETRY_LIMIT) {
      clearInterval(timer);
      return;
    }
    apply();
  }, PRESENTATION_RETRY_INTERVAL_MS);
}

/**
 * Debounces save on window move, resize, and maximize changes.
 */
export function trackWindowState(window: BrowserWindow): void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const scheduleSave = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => saveWindowState(window), SAVE_DEBOUNCE_MS);
  };

  window.on('resize', scheduleSave);
  window.on('move', scheduleSave);
  window.on('maximize', scheduleSave);
  window.on('unmaximize', scheduleSave);
}
