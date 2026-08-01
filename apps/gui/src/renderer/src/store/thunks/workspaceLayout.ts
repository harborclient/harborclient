import {
  DEFAULT_GIT_SIDEBAR_EXPANSION,
  type GitSidebarExpansionState
} from '@harborclient/core/gitSidebarExpansion';
import {
  WORKSPACE_PANEL_SIZE_KEYS,
  type WorkspaceLayout,
  type WorkspacePanelSizeKey
} from '@harborclient/core/types/workspace';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import {
  setActivePluginFooterPanelId,
  setRequestEditorSplitHeight,
  setShowAiSidebar,
  setShowConsole,
  setShowGitSidebar,
  setShowMcp,
  setShowRail,
  setShowRequestEditor,
  setShowResponseEditor,
  setShowShortcutsSidebar,
  setShowSidebar,
  setLiveServerLogsPlacement,
  setLiveServerLogsPlacements,
  setShowLiveServerLogs,
  setShowTerminal,
  setShowVariables
} from '#/renderer/src/store/slices/navigationSlice';
import { setActiveEnvironmentId } from '#/renderer/src/store/slices/environmentsSlice';
import { applyThemePreference } from '#/renderer/src/plugins/themeRuntime';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';
import { applyRegisteredSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/sidebarExpansionBridge';
import { applyGitSidebarExpansion } from '#/renderer/src/ui/Sidebars/GitSidebar/useGitSidebarExpansion';

/** Window event name used by SDK `useResizable` to re-read sizes after external writes. */
const RESIZABLE_SYNC_EVENT = 'hc:resizable-sync';

/** localStorage key for Git sidebar expansion (must match the Git sidebar hook). */
const GIT_SIDEBAR_EXPANSION_KEY = 'hc.gitSidebarExpansion';

/**
 * Writes resizable panel sizes to localStorage and notifies mounted hooks to re-read.
 *
 * Kept local so workspace thunks do not import the React-backed SDK components
 * barrel (which requires the plugin React host under vitest).
 *
 * @param entries - Map of storageKey → size in pixels.
 */
function applyResizableSizes(entries: Record<string, number>): void {
  for (const [storageKey, size] of Object.entries(entries)) {
    if (!Number.isFinite(size)) {
      continue;
    }
    try {
      localStorage.setItem(storageKey, String(Math.round(size)));
    } catch {
      // Ignore quota or privacy-mode failures.
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RESIZABLE_SYNC_EVENT));
  }
}

/**
 * Reads a single panel size from localStorage when present and finite.
 *
 * @param storageKey - Resizable panel localStorage key.
 * @returns Rounded size in pixels, or undefined when unset/invalid.
 */
function readPanelSize(storageKey: WorkspacePanelSizeKey): number | undefined {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return undefined;
    }
    const size = Number(raw);
    return Number.isFinite(size) ? Math.round(size) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reads all workspace panel sizes currently stored in localStorage.
 *
 * @returns Partial map of storageKey → size for keys that have values.
 */
function readPanelSizes(): WorkspaceLayout['panelSizes'] {
  const panelSizes: WorkspaceLayout['panelSizes'] = {};
  for (const key of WORKSPACE_PANEL_SIZE_KEYS) {
    const size = readPanelSize(key);
    if (size != null) {
      panelSizes[key] = size;
    }
  }
  return panelSizes;
}

/**
 * Reads Git sidebar expansion from localStorage, falling back to defaults.
 *
 * @returns Normalized Git sidebar expansion snapshot.
 */
function readGitSidebarExpansion(): GitSidebarExpansionState {
  try {
    const raw = localStorage.getItem(GIT_SIDEBAR_EXPANSION_KEY);
    if (!raw) {
      return {
        sections: { ...DEFAULT_GIT_SIDEBAR_EXPANSION.sections },
        sectionVisibility: { ...DEFAULT_GIT_SIDEBAR_EXPANSION.sectionVisibility }
      };
    }
    const parsed = JSON.parse(raw) as Partial<GitSidebarExpansionState>;
    return {
      sections: {
        ...DEFAULT_GIT_SIDEBAR_EXPANSION.sections,
        ...parsed.sections
      },
      sectionVisibility: {
        ...DEFAULT_GIT_SIDEBAR_EXPANSION.sectionVisibility,
        ...parsed.sectionVisibility
      }
    };
  } catch {
    return {
      sections: { ...DEFAULT_GIT_SIDEBAR_EXPANSION.sections },
      sectionVisibility: { ...DEFAULT_GIT_SIDEBAR_EXPANSION.sectionVisibility }
    };
  }
}

/**
 * Resolves the active environment uuid from Redux state.
 *
 * @param state - Root Redux state.
 * @returns Environment uuid, or null when none is selected / found.
 */
function resolveActiveEnvironmentUuid(state: RootState): string | null {
  const activeId = state.environments.activeEnvironmentId;
  if (activeId == null) {
    return null;
  }
  const match = state.environments.environments.find((environment) => environment.id === activeId);
  return match?.uuid ?? null;
}

/**
 * Resolves an environment uuid back to a local numeric id.
 *
 * @param state - Root Redux state.
 * @param uuid - Environment uuid from a workspace layout.
 * @returns Matching environment id, or null when the environment no longer exists.
 */
function resolveEnvironmentIdByUuid(state: RootState, uuid: string | null): number | null {
  if (uuid == null) {
    return null;
  }
  const match = state.environments.environments.find((environment) => environment.uuid === uuid);
  return match?.id ?? null;
}

/**
 * Captures the current UI layout for persistence inside a workspace.
 *
 * @param state - Root Redux state at capture time.
 * @returns Layout snapshot including panels, sizes, sidebars, environment, and theme.
 */
export async function captureWorkspaceLayout(state: RootState): Promise<WorkspaceLayout> {
  const navigation = state.navigation;
  const [sidebarExpansion, theme] = await Promise.all([
    window.api.getSidebarExpansion(),
    window.api.getTheme()
  ]);

  return {
    panels: {
      showSidebar: navigation.showSidebar,
      showRail: navigation.showRail,
      showAiSidebar: navigation.showAiSidebar,
      showGitSidebar: navigation.showGitSidebar,
      showShortcutsSidebar: navigation.showShortcutsSidebar,
      showRequestEditor: navigation.showRequestEditor,
      showResponseEditor: navigation.showResponseEditor,
      requestEditorSplitHeight: navigation.requestEditorSplitHeight,
      showConsole: navigation.showConsole,
      showVariables: navigation.showVariables,
      showMcp: navigation.showMcp,
      showTerminal: navigation.showTerminal,
      showLiveServerLogs: navigation.showLiveServerLogs,
      liveServerLogsPlacement: navigation.liveServerLogsPlacement,
      liveServerLogsPlacements: navigation.liveServerLogsPlacements,
      activePluginFooterPanelId: navigation.activePluginFooterPanelId
    },
    panelSizes: readPanelSizes(),
    sidebarExpansion,
    gitSidebar: readGitSidebarExpansion(),
    activeEnvironmentUuid: resolveActiveEnvironmentUuid(state),
    theme
  };
}

/**
 * Restores a workspace layout snapshot into the live UI and its persistence backends.
 *
 * @param layout - Layout captured when the workspace was saved.
 * @param dispatch - Redux dispatch for panel and environment updates.
 * @param getState - Reads current environments for uuid → id resolution.
 */
export async function applyWorkspaceLayout(
  layout: WorkspaceLayout,
  dispatch: AppDispatch,
  getState: () => RootState
): Promise<void> {
  const { panels } = layout;

  dispatch(setShowSidebar(panels.showSidebar));
  dispatch(setShowRail(panels.showRail));
  if (panels.showGitSidebar) {
    dispatch(setShowGitSidebar(true));
  } else if (panels.showAiSidebar) {
    dispatch(setShowAiSidebar(true));
  } else if (panels.showShortcutsSidebar) {
    dispatch(setShowShortcutsSidebar(true));
  } else {
    dispatch(setShowAiSidebar(false));
    dispatch(setShowGitSidebar(false));
    dispatch(setShowShortcutsSidebar(false));
  }
  dispatch(setShowRequestEditor(panels.showRequestEditor));
  dispatch(setShowResponseEditor(panels.showResponseEditor));
  dispatch(setRequestEditorSplitHeight(panels.requestEditorSplitHeight));
  dispatch(setShowConsole(panels.showConsole));
  dispatch(setShowVariables(panels.showVariables));
  dispatch(setShowMcp(panels.showMcp));
  dispatch(setShowTerminal(panels.showTerminal));
  dispatch(setLiveServerLogsPlacement(panels.liveServerLogsPlacement));
  dispatch(setLiveServerLogsPlacements(panels.liveServerLogsPlacements));
  dispatch(setShowLiveServerLogs(false));
  dispatch(setActivePluginFooterPanelId(panels.activePluginFooterPanelId));

  const sizeEntries: Record<string, number> = {};
  for (const [key, size] of Object.entries(layout.panelSizes)) {
    if (typeof size === 'number' && Number.isFinite(size)) {
      sizeEntries[key] = size;
    }
  }
  if (Object.keys(sizeEntries).length > 0) {
    applyResizableSizes(sizeEntries);
  }

  applyRegisteredSidebarExpansion(layout.sidebarExpansion);
  applyGitSidebarExpansion(layout.gitSidebar);

  const environmentId = resolveEnvironmentIdByUuid(getState(), layout.activeEnvironmentUuid);
  dispatch(setActiveEnvironmentId(environmentId));

  if (layout.theme == null) {
    return;
  }

  try {
    const activeTheme = await window.api.getTheme();
    if (layout.theme === activeTheme) {
      return;
    }
    await applyThemePreference(layout.theme);
    await window.api.setTheme(layout.theme);
  } catch (err: unknown) {
    showAlert(dispatch, formatErrorMessage(err, 'Failed to restore workspace theme'));
  }
}
