import Store from 'electron-store';
import {
  DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT,
  type LiveServerLogsPlacement,
  type PanelLayoutState
} from '@harborclient/core/types';

const STORE_KEY = 'panelLayout';

/** Minimum request editor split height in pixels. */
export const MIN_REQUEST_EDITOR_SPLIT_HEIGHT = 160;

/** Maximum request editor split height in pixels. */
export const MAX_REQUEST_EDITOR_SPLIT_HEIGHT = 2000;

export const DEFAULT_PANEL_LAYOUT: PanelLayoutState = {
  showSidebar: true,
  showRail: true,
  showAiSidebar: false,
  showGitSidebar: false,
  showShortcutsSidebar: false,
  showRequestEditor: true,
  showResponseEditor: true,
  requestEditorSplitHeight: DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT,
  showConsole: false,
  showVariables: false,
  showMcp: false,
  showTerminal: false,
  showLiveServerLogs: false,
  liveServerLogsPlacement: 'footer',
  liveServerLogsPlacements: {},
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
 * Normalizes live-server logs dock placement from storage or user input.
 *
 * @param value - Raw placement candidate.
 * @returns Sanitized placement, defaulting to footer.
 */
function normalizeLiveServerLogsPlacement(value: unknown): LiveServerLogsPlacement {
  return value === 'sidebar' ? 'sidebar' : 'footer';
}

/**
 * Normalizes the per-server live-server logs dock map.
 *
 * @param value - Raw placements object keyed by saved server id string.
 * @returns Sanitized map containing only footer/sidebar values.
 */
function normalizeLiveServerLogsPlacements(
  value: unknown
): Record<string, LiveServerLogsPlacement> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const result: Record<string, LiveServerLogsPlacement> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (key.length === 0) {
      continue;
    }
    if (raw === 'footer' || raw === 'sidebar') {
      result[key] = raw;
    }
  }
  return result;
}

/**
 * Normalizes footer panel visibility so at most one built-in or plugin panel is open.
 *
 * When live-server logs are docked to the sidebar, {@link PanelLayoutState.showLiveServerLogs}
 * does not participate in footer exclusivity.
 *
 * @param input - Raw footer panel flags from storage or user input.
 * @param liveServerLogsPlacement - Dock placement for the logs viewer.
 * @returns Footer panel visibility with mutual exclusivity enforced.
 */
function normalizeFooterPanels(
  input: Partial<PanelLayoutState>,
  liveServerLogsPlacement: LiveServerLogsPlacement
): Pick<
  PanelLayoutState,
  | 'showConsole'
  | 'showVariables'
  | 'showMcp'
  | 'showTerminal'
  | 'showLiveServerLogs'
  | 'activePluginFooterPanelId'
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
  const showLiveServerLogs = input.showLiveServerLogs === true;
  const logsAsFooter = showLiveServerLogs && liveServerLogsPlacement === 'footer';
  const logsAsSidebar = showLiveServerLogs && liveServerLogsPlacement === 'sidebar';

  if (activePluginFooterPanelId) {
    return {
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      showLiveServerLogs: logsAsSidebar,
      activePluginFooterPanelId
    };
  }

  if (showConsole) {
    return {
      showConsole: true,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      showLiveServerLogs: logsAsSidebar,
      activePluginFooterPanelId: null
    };
  }
  if (showVariables) {
    return {
      showConsole: false,
      showVariables: true,
      showMcp: false,
      showTerminal: false,
      showLiveServerLogs: logsAsSidebar,
      activePluginFooterPanelId: null
    };
  }
  if (showMcp) {
    return {
      showConsole: false,
      showVariables: false,
      showMcp: true,
      showTerminal: false,
      showLiveServerLogs: logsAsSidebar,
      activePluginFooterPanelId: null
    };
  }
  if (showTerminal) {
    return {
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: true,
      showLiveServerLogs: logsAsSidebar,
      activePluginFooterPanelId: null
    };
  }
  if (logsAsFooter) {
    return {
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      showLiveServerLogs: true,
      activePluginFooterPanelId: null
    };
  }

  return {
    showConsole: false,
    showVariables: false,
    showMcp: false,
    showTerminal: false,
    showLiveServerLogs: logsAsSidebar,
    activePluginFooterPanelId: null
  };
}

/**
 * Normalizes panel layout from storage or user input.
 *
 * @param input - Partial or raw panel layout.
 * @returns Sanitized panel layout state.
 */
function normalizePanelLayout(input: Partial<PanelLayoutState>): PanelLayoutState {
  const liveServerLogsPlacement = normalizeLiveServerLogsPlacement(input.liveServerLogsPlacement);
  const liveServerLogsPlacements = normalizeLiveServerLogsPlacements(
    input.liveServerLogsPlacements
  );
  const footerPanels = normalizeFooterPanels(input, liveServerLogsPlacement);
  const logsAsSidebar = footerPanels.showLiveServerLogs && liveServerLogsPlacement === 'sidebar';

  const showGitSidebar = !logsAsSidebar && input.showGitSidebar === true;
  const showAiSidebar = !logsAsSidebar && !showGitSidebar && input.showAiSidebar === true;
  const showShortcutsSidebar =
    !logsAsSidebar && !showGitSidebar && !showAiSidebar && input.showShortcutsSidebar === true;

  return {
    showSidebar: input.showSidebar !== false,
    showRail: input.showRail !== false,
    showAiSidebar,
    showGitSidebar,
    showShortcutsSidebar,
    showRequestEditor: input.showRequestEditor !== false,
    showResponseEditor: input.showResponseEditor !== false,
    requestEditorSplitHeight: normalizeRequestEditorSplitHeight(input.requestEditorSplitHeight),
    liveServerLogsPlacement,
    liveServerLogsPlacements,
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
