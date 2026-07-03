import Store from 'electron-store';
import { DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT, type PanelLayoutState } from '#/shared/types';

const STORE_KEY = 'panelLayout';

/** Minimum request editor split height in pixels. */
export const MIN_REQUEST_EDITOR_SPLIT_HEIGHT = 160;

/** Maximum request editor split height in pixels. */
export const MAX_REQUEST_EDITOR_SPLIT_HEIGHT = 2000;

export const DEFAULT_PANEL_LAYOUT: PanelLayoutState = {
  showSidebar: true,
  showAiSidebar: false,
  showRequestEditor: true,
  showResponseEditor: true,
  requestEditorSplitHeight: DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT
};

let store: Store<{ panelLayout: PanelLayoutState }> | null = null;

/**
 * Returns the lazy electron-store instance for panel layout preferences.
 */
function getStore(): Store<{ panelLayout: PanelLayoutState }> {
  if (!store) {
    store = new Store<{ panelLayout: PanelLayoutState }>({
      name: 'settings',
      defaults: {
        panelLayout: DEFAULT_PANEL_LAYOUT
      }
    });
  }
  return store;
}

/**
 * Normalizes panel layout from storage or user input.
 *
 * @param input - Partial or raw panel layout.
 * @returns Sanitized panel layout state.
 */
/**
 * Clamps request editor split height to supported bounds.
 *
 * @param value - Raw height from storage or user input.
 * @returns Normalized height in pixels.
 */
function normalizeRequestEditorSplitHeight(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_PANEL_LAYOUT.requestEditorSplitHeight;
  }
  return Math.min(
    MAX_REQUEST_EDITOR_SPLIT_HEIGHT,
    Math.max(MIN_REQUEST_EDITOR_SPLIT_HEIGHT, Math.round(parsed))
  );
}

function normalizePanelLayout(input: Partial<PanelLayoutState>): PanelLayoutState {
  return {
    showSidebar: input.showSidebar !== false,
    showAiSidebar: input.showAiSidebar === true,
    showRequestEditor: input.showRequestEditor !== false,
    showResponseEditor: input.showResponseEditor !== false,
    requestEditorSplitHeight: normalizeRequestEditorSplitHeight(input.requestEditorSplitHeight)
  };
}

/**
 * Returns persisted sidebar visibility preferences.
 */
export function getPanelLayout(): PanelLayoutState {
  const stored = getStore().get(STORE_KEY, DEFAULT_PANEL_LAYOUT);
  return normalizePanelLayout(stored ?? DEFAULT_PANEL_LAYOUT);
}

/**
 * Persists sidebar visibility preferences.
 *
 * @param state - Panel layout snapshot to store.
 */
export function setPanelLayout(state: PanelLayoutState): void {
  getStore().set(STORE_KEY, normalizePanelLayout(state));
}
