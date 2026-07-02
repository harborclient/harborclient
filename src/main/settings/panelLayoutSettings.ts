import Store from 'electron-store';
import type { PanelLayoutState } from '#/shared/types';

const STORE_KEY = 'panelLayout';

export const DEFAULT_PANEL_LAYOUT: PanelLayoutState = {
  showSidebar: true,
  showAiSidebar: false,
  showRequestEditor: true,
  showResponseEditor: true
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
function normalizePanelLayout(input: Partial<PanelLayoutState>): PanelLayoutState {
  return {
    showSidebar: input.showSidebar !== false,
    showAiSidebar: input.showAiSidebar === true,
    showRequestEditor: input.showRequestEditor !== false,
    showResponseEditor: input.showResponseEditor !== false
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
