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
  requestEditorSplitHeight: DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT,
  showConsole: false,
  showVariables: false,
  showMcp: false,
  showTerminal: false,
  activePluginFooterPanelId: null
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

/**
 * Normalizes footer panel visibility so at most one built-in or plugin panel is open.
 *
 * @param input - Raw footer panel flags from storage or user input.
 * @returns Footer panel visibility with mutual exclusivity enforced.
 */
function normalizeFooterPanels(
  input: Partial<PanelLayoutState>
): Pick<
  PanelLayoutState,
  'showConsole' | 'showVariables' | 'showMcp' | 'showTerminal' | 'activePluginFooterPanelId'
> {
  const activePluginFooterPanelId =
    typeof input.activePluginFooterPanelId === 'string' &&
    input.activePluginFooterPanelId.length > 0
      ? input.activePluginFooterPanelId
      : null;
  const showConsole = input.showConsole === true;
  const showVariables = input.showVariables === true;
  const showMcp = input.showMcp === true;
  const showTerminal = input.showTerminal === true;

  if (activePluginFooterPanelId) {
    return {
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      activePluginFooterPanelId
    };
  }

  if (showConsole) {
    return {
      showConsole: true,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      activePluginFooterPanelId: null
    };
  }
  if (showVariables) {
    return {
      showConsole: false,
      showVariables: true,
      showMcp: false,
      showTerminal: false,
      activePluginFooterPanelId: null
    };
  }
  if (showMcp) {
    return {
      showConsole: false,
      showVariables: false,
      showMcp: true,
      showTerminal: false,
      activePluginFooterPanelId: null
    };
  }
  if (showTerminal) {
    return {
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: true,
      activePluginFooterPanelId: null
    };
  }

  return {
    showConsole: false,
    showVariables: false,
    showMcp: false,
    showTerminal: false,
    activePluginFooterPanelId: null
  };
}

function normalizePanelLayout(input: Partial<PanelLayoutState>): PanelLayoutState {
  const footerPanels = normalizeFooterPanels(input);

  return {
    showSidebar: input.showSidebar !== false,
    showAiSidebar: input.showAiSidebar === true,
    showRequestEditor: input.showRequestEditor !== false,
    showResponseEditor: input.showResponseEditor !== false,
    requestEditorSplitHeight: normalizeRequestEditorSplitHeight(input.requestEditorSplitHeight),
    ...footerPanels
  };
}

/**
 * Returns persisted sidebar, editor, and footer panel layout preferences.
 */
export function getPanelLayout(): PanelLayoutState {
  const stored = getStore().get(STORE_KEY, DEFAULT_PANEL_LAYOUT);
  return normalizePanelLayout(stored ?? DEFAULT_PANEL_LAYOUT);
}

/**
 * Persists sidebar, editor, and footer panel layout preferences.
 *
 * @param state - Panel layout snapshot to store.
 */
export function setPanelLayout(state: PanelLayoutState): void {
  getStore().set(STORE_KEY, normalizePanelLayout(state));
}
