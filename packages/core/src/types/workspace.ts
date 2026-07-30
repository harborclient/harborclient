import { z } from 'zod';
import {
  DEFAULT_GIT_SIDEBAR_EXPANSION,
  type GitSidebarExpansionState
} from '../gitSidebarExpansion';
import { normalizeSidebarExpansion } from '../sidebarExpansion';
import type { PanelLayoutState, SidebarExpansionState, ThemeSource } from './settings';
import { DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT } from './settings';

/**
 * localStorage keys for resizable panel widths and footer heights captured in a
 * workspace layout snapshot.
 */
export const WORKSPACE_PANEL_SIZE_KEYS = [
  'hc.sidebarWidth',
  'hc.aiSidebarWidth',
  'hc.gitSidebarWidth',
  'hc.shortcutsSidebarWidth',
  'hc.consoleHeight',
  'hc.variablesHeight',
  'hc.mcpPanelHeight',
  'hc.terminalPanelHeight',
  'hc.terminalTabListWidth'
] as const;

/**
 * One localStorage key for a workspace panel size.
 */
export type WorkspacePanelSizeKey = (typeof WORKSPACE_PANEL_SIZE_KEYS)[number];

/**
 * Default panel visibility used when normalizing a partial workspace layout.
 */
const DEFAULT_WORKSPACE_PANELS: PanelLayoutState = {
  showSidebar: true,
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
  activePluginFooterPanelId: null
};

/**
 * Captured UI layout restored when a workspace is opened.
 */
export interface WorkspaceLayout {
  /**
   * Sidebar, editor, and footer panel visibility (and request/response split height).
   */
  panels: PanelLayoutState;

  /**
   * Resizable panel widths and footer heights keyed by localStorage storage key.
   */
  panelSizes: Partial<Record<WorkspacePanelSizeKey, number>>;

  /**
   * Collections sidebar expansion, section visibility, and Appearance display toggles.
   */
  sidebarExpansion: SidebarExpansionState;

  /**
   * Git sidebar section expansion and visibility.
   */
  gitSidebar: GitSidebarExpansionState;

  /**
   * Active environment uuid at capture time, or null when none was selected.
   */
  activeEnvironmentUuid: string | null;

  /**
   * Selected appearance theme at capture time, or null when unset.
   */
  theme: ThemeSource | null;
}

/**
 * One saved request reference stored in a workspace.
 */
export interface WorkspaceRequest {
  /**
   * Stable request uuid used for export and reopen.
   */
  requestUuid: string;

  /**
   * Collection id at capture time for faster reopen.
   */
  collectionId?: number;

  /**
   * Display name at capture time for sidebar rows.
   */
  requestName?: string;
}

/**
 * A named set of saved request tabs persisted in the local registry.
 */
export interface Workspace {
  /**
   * Numeric primary key in the local registry.
   */
  id: number;

  /**
   * User-visible workspace name.
   */
  name: string;

  /**
   * Ordered saved requests in this workspace.
   */
  requests: WorkspaceRequest[];

  /**
   * Unix epoch milliseconds when the workspace was created.
   */
  createdAt: number;

  /**
   * Unix epoch milliseconds when the workspace was last updated.
   */
  updatedAt: number;

  /**
   * Optional sidebar marker for visual grouping (CSS hex or rgba string).
   */
  marker?: string | null;

  /**
   * Captured UI layout snapshot, or null for workspaces created before layout support.
   */
  layout?: WorkspaceLayout | null;
}

/**
 * Input for creating a workspace from the renderer.
 */
export interface CreateWorkspaceInput {
  /**
   * User-visible workspace name.
   */
  name: string;

  /**
   * Ordered saved requests to store in the workspace.
   */
  requests: WorkspaceRequest[];

  /**
   * Optional sidebar marker for visual grouping (CSS hex or rgba string).
   */
  marker?: string | null;

  /**
   * Optional UI layout snapshot captured at create time.
   */
  layout?: WorkspaceLayout | null;
}

/**
 * Zod schema for a ThemeSource string used in workspace layout IPC and export.
 */
const workspaceThemeSourceSchema: z.ZodType<ThemeSource> = z.union([
  z.enum(['light', 'dark', 'system', 'high-contrast']),
  z.string().regex(/^plugin:[^:]+:[^:]+$/),
  z.string().regex(/^custom:[^/\\]+$/)
]) as z.ZodType<ThemeSource>;

/** Supported sidebar sort modes for workspace layout validation. */
const workspaceSidebarSortMode = z.enum([
  'default',
  'name-asc',
  'name-desc',
  'method-asc',
  'method-desc',
  'created-asc',
  'created-desc',
  'marker'
]);

/**
 * Zod schema for panel visibility inside a workspace layout.
 */
const workspacePanelsSchema = z.object({
  showSidebar: z.boolean(),
  showAiSidebar: z.boolean(),
  showGitSidebar: z.boolean(),
  showShortcutsSidebar: z.boolean(),
  showRequestEditor: z.boolean(),
  showResponseEditor: z.boolean(),
  requestEditorSplitHeight: z.number().finite(),
  showConsole: z.boolean(),
  showVariables: z.boolean(),
  showMcp: z.boolean(),
  showTerminal: z.boolean(),
  activePluginFooterPanelId: z.string().nullable()
}) satisfies z.ZodType<PanelLayoutState>;

/**
 * Zod schema for collections sidebar expansion inside a workspace layout.
 */
const workspaceSidebarExpansionSchema = z.object({
  sections: z.object({
    collections: z.boolean(),
    environments: z.boolean(),
    runResults: z.boolean(),
    history: z.boolean(),
    workspaces: z.boolean(),
    workflows: z.boolean(),
    websites: z.boolean(),
    liveServers: z.boolean(),
    archive: z.boolean(),
    trash: z.boolean()
  }),
  activeSidebarMode: z.enum([
    'collections',
    'environments',
    'workspaces',
    'workflows',
    'servers',
    'trash'
  ]),
  sidebarRailExpanded: z.boolean(),
  sectionSort: z.object({
    collections: workspaceSidebarSortMode,
    environments: workspaceSidebarSortMode,
    runResults: workspaceSidebarSortMode,
    history: workspaceSidebarSortMode,
    workspaces: workspaceSidebarSortMode,
    workflows: workspaceSidebarSortMode,
    websites: workspaceSidebarSortMode,
    liveServers: workspaceSidebarSortMode,
    archive: workspaceSidebarSortMode,
    trash: workspaceSidebarSortMode
  }),
  collectionIds: z.array(z.number().int().positive()),
  folderIds: z.array(z.number().int().positive()),
  environmentIds: z.array(z.number().int().positive()),
  showStorageLocationBadges: z.boolean(),
  showMarkers: z.boolean(),
  showMethodColors: z.boolean(),
  showIndicators: z.boolean(),
  showFilters: z.boolean(),
  showSorting: z.boolean()
}) satisfies z.ZodType<SidebarExpansionState>;

/**
 * Zod schema for Git sidebar expansion inside a workspace layout.
 */
const workspaceGitSidebarSchema = z.object({
  sections: z.object({
    commitMessage: z.boolean(),
    changes: z.boolean(),
    commits: z.boolean()
  }),
  sectionVisibility: z.object({
    commitMessage: z.boolean(),
    changes: z.boolean(),
    commits: z.boolean()
  })
}) satisfies z.ZodType<GitSidebarExpansionState>;

/**
 * Zod schema for a full workspace layout snapshot (IPC create/update and export).
 */
export const workspaceLayoutSchema = z.object({
  panels: workspacePanelsSchema,
  panelSizes: z.record(z.string(), z.number().finite()) as z.ZodType<
    Partial<Record<WorkspacePanelSizeKey, number>>
  >,
  sidebarExpansion: workspaceSidebarExpansionSchema,
  gitSidebar: workspaceGitSidebarSchema,
  activeEnvironmentUuid: z.union([z.string().trim().min(1), z.null()]),
  theme: z.union([workspaceThemeSourceSchema, z.null()])
}) satisfies z.ZodType<WorkspaceLayout>;

/**
 * Portable workspace export envelope.
 */
export interface WorkspaceExport {
  /**
   * HarborClient export schema version.
   *
   * Version 1 stores only request uuids. Version 2 may include a layout snapshot.
   */
  harborclientVersion: 1 | 2;

  /**
   * Export discriminator for File -> Import routing.
   */
  harborclientExport: 'workspace';

  /**
   * Exported workspace name.
   */
  name: string;

  /**
   * Saved request uuids in display order. Full request details are not exported.
   */
  requestUuids: string[];

  /**
   * Optional sidebar marker for visual grouping (CSS hex or rgba string).
   */
  marker?: string | null;

  /**
   * Optional UI layout snapshot (version 2 exports).
   */
  layout?: WorkspaceLayout | null;
}

/**
 * Zod schema for validating workspace export files.
 */
export const workspaceExportSchema = z.object({
  harborclientVersion: z.union([z.literal(1), z.literal(2)]),
  harborclientExport: z.literal('workspace'),
  name: z.string().trim().min(1),
  requestUuids: z.array(z.string().trim().min(1)),
  marker: z.union([z.string().trim().min(1), z.null()]).optional(),
  layout: workspaceLayoutSchema.nullish()
}) satisfies z.ZodType<WorkspaceExport>;

/**
 * Validates a parsed workspace export payload.
 *
 * @param data - Parsed JSON from an export file.
 * @returns Validated export envelope.
 * @throws When the payload does not match the workspace export schema.
 */
export function validateWorkspaceExport(data: unknown): WorkspaceExport {
  const result = workspaceExportSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid workspace export: ${result.error.message}`);
  }
  return result.data;
}

/**
 * Returns whether a value is a known workspace panel size key.
 *
 * @param value - Candidate storage key.
 */
function isWorkspacePanelSizeKey(value: string): value is WorkspacePanelSizeKey {
  return (WORKSPACE_PANEL_SIZE_KEYS as readonly string[]).includes(value);
}

/**
 * Returns whether a string is a valid ThemeSource.
 *
 * @param value - Candidate theme preference.
 */
function isThemeSource(value: string): value is ThemeSource {
  if (value === 'light' || value === 'dark' || value === 'system' || value === 'high-contrast') {
    return true;
  }
  return /^plugin:[^:]+:[^:]+$/.test(value) || /^custom:[^/\\]+$/.test(value);
}

/**
 * Normalizes footer panel flags so at most one built-in or plugin panel is open.
 *
 * @param input - Partial panel layout fields.
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

/**
 * Normalizes panel visibility from a partial or raw workspace layout field.
 *
 * @param value - Raw panels object.
 */
function normalizeWorkspacePanels(value: unknown): PanelLayoutState {
  const input = value && typeof value === 'object' ? (value as Partial<PanelLayoutState>) : {};
  const splitHeight = Number(input.requestEditorSplitHeight);
  const requestEditorSplitHeight = Number.isFinite(splitHeight)
    ? Math.round(splitHeight)
    : DEFAULT_WORKSPACE_PANELS.requestEditorSplitHeight;

  return {
    showSidebar: input.showSidebar !== false,
    showAiSidebar: input.showAiSidebar === true,
    showGitSidebar: input.showGitSidebar === true,
    showShortcutsSidebar: input.showShortcutsSidebar === true,
    showRequestEditor: input.showRequestEditor !== false,
    showResponseEditor: input.showResponseEditor !== false,
    requestEditorSplitHeight,
    ...normalizeFooterPanels(input)
  };
}

/**
 * Normalizes resizable panel sizes, dropping unknown keys and non-finite values.
 *
 * @param value - Raw panelSizes object.
 */
function normalizePanelSizes(value: unknown): Partial<Record<WorkspacePanelSizeKey, number>> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const result: Partial<Record<WorkspacePanelSizeKey, number>> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!isWorkspacePanelSizeKey(key)) {
      continue;
    }
    const size = Number(raw);
    if (!Number.isFinite(size)) {
      continue;
    }
    result[key] = Math.round(size);
  }
  return result;
}

/**
 * Normalizes Git sidebar expansion from a partial or raw workspace layout field.
 *
 * @param value - Raw gitSidebar object.
 */
function normalizeGitSidebar(value: unknown): GitSidebarExpansionState {
  if (!value || typeof value !== 'object') {
    return {
      sections: { ...DEFAULT_GIT_SIDEBAR_EXPANSION.sections },
      sectionVisibility: { ...DEFAULT_GIT_SIDEBAR_EXPANSION.sectionVisibility }
    };
  }

  const raw = value as Partial<GitSidebarExpansionState>;
  return {
    sections: {
      commitMessage:
        typeof raw.sections?.commitMessage === 'boolean'
          ? raw.sections.commitMessage
          : DEFAULT_GIT_SIDEBAR_EXPANSION.sections.commitMessage,
      changes:
        typeof raw.sections?.changes === 'boolean'
          ? raw.sections.changes
          : DEFAULT_GIT_SIDEBAR_EXPANSION.sections.changes,
      commits:
        typeof raw.sections?.commits === 'boolean'
          ? raw.sections.commits
          : DEFAULT_GIT_SIDEBAR_EXPANSION.sections.commits
    },
    sectionVisibility: {
      commitMessage:
        typeof raw.sectionVisibility?.commitMessage === 'boolean'
          ? raw.sectionVisibility.commitMessage
          : DEFAULT_GIT_SIDEBAR_EXPANSION.sectionVisibility.commitMessage,
      changes:
        typeof raw.sectionVisibility?.changes === 'boolean'
          ? raw.sectionVisibility.changes
          : DEFAULT_GIT_SIDEBAR_EXPANSION.sectionVisibility.changes,
      commits:
        typeof raw.sectionVisibility?.commits === 'boolean'
          ? raw.sectionVisibility.commits
          : DEFAULT_GIT_SIDEBAR_EXPANSION.sectionVisibility.commits
    }
  };
}

/**
 * Normalizes a persisted or exported workspace layout blob.
 *
 * Returns null when the value is absent (legacy workspaces without a layout).
 * Partial or malformed objects are filled with defaults and never throw.
 *
 * @param value - Raw layout JSON from SQLite, export, or IPC.
 * @returns Normalized layout, or null when no layout was stored.
 */
export function normalizeWorkspaceLayout(value: unknown): WorkspaceLayout | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return normalizeWorkspaceLayout(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }

  if (typeof value !== 'object') {
    return null;
  }

  const raw = value as Partial<WorkspaceLayout>;
  const theme =
    typeof raw.theme === 'string' && isThemeSource(raw.theme)
      ? raw.theme
      : raw.theme === null
        ? null
        : null;
  const activeEnvironmentUuid =
    typeof raw.activeEnvironmentUuid === 'string' && raw.activeEnvironmentUuid.trim().length > 0
      ? raw.activeEnvironmentUuid.trim()
      : null;

  return {
    panels: normalizeWorkspacePanels(raw.panels),
    panelSizes: normalizePanelSizes(raw.panelSizes),
    sidebarExpansion: normalizeSidebarExpansion(raw.sidebarExpansion),
    gitSidebar: normalizeGitSidebar(raw.gitSidebar),
    activeEnvironmentUuid,
    theme
  };
}

/**
 * Serializes a workspace layout for SQLite storage.
 *
 * @param layout - Layout to persist, or null/undefined to clear.
 * @returns JSON string, or null when no layout should be stored.
 */
export function serializeWorkspaceLayout(
  layout: WorkspaceLayout | null | undefined
): string | null {
  if (layout == null) {
    return null;
  }
  const normalized = normalizeWorkspaceLayout(layout);
  return normalized == null ? null : JSON.stringify(normalized);
}
