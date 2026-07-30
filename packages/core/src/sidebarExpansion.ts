import type {
  SidebarExpansionState,
  SidebarMode,
  SidebarSectionKey,
  SidebarSortMode
} from './types/settings';

const DEFAULT_SECTIONS = {
  collections: true,
  environments: true,
  runResults: true,
  history: true,
  workspaces: true,
  workflows: true,
  websites: true,
  archive: true,
  trash: true
} as const;

const DEFAULT_SECTION_SORT: Record<SidebarSectionKey, SidebarSortMode> = {
  collections: 'default',
  environments: 'default',
  runResults: 'default',
  history: 'default',
  workspaces: 'default',
  workflows: 'default',
  websites: 'default',
  archive: 'default',
  trash: 'default'
};

const SIDEBAR_SECTION_KEYS: readonly SidebarSectionKey[] = [
  'collections',
  'environments',
  'runResults',
  'history',
  'workspaces',
  'workflows',
  'websites',
  'archive',
  'trash'
];

const SIDEBAR_SORT_MODES: readonly SidebarSortMode[] = [
  'default',
  'name-asc',
  'name-desc',
  'method-asc',
  'method-desc',
  'created-asc',
  'created-desc',
  'marker'
];

const SIDEBAR_MODES: readonly SidebarMode[] = [
  'collections',
  'environments',
  'workspaces',
  'workflows',
  'trash'
];

const DEFAULT_ACTIVE_SIDEBAR_MODE: SidebarMode = 'collections';
const DEFAULT_SIDEBAR_RAIL_EXPANDED = false;

const DEFAULT_SHOW_STORAGE_LOCATION_BADGES = true;
const DEFAULT_SHOW_MARKERS = true;
const DEFAULT_SHOW_METHOD_COLORS = true;
const DEFAULT_SHOW_INDICATORS = true;
const DEFAULT_SHOW_FILTERS = false;
const DEFAULT_SHOW_SORTING = false;

/**
 * Sections mounted for each activity-rail mode.
 *
 * History and Archive appear under both Collections and Workflows. The shell
 * mounts mode-scoped content: Collections mode shows request history and
 * archived collections; Workflows mode shows workflow run history and archived
 * workflows. Array order is the visual accordion order.
 */
export const SIDEBAR_MODE_SECTIONS: Record<SidebarMode, readonly SidebarSectionKey[]> = {
  collections: ['collections', 'runResults', 'history', 'archive', 'websites'],
  environments: ['environments'],
  workspaces: ['workspaces'],
  workflows: ['workflows', 'history', 'archive'],
  trash: ['trash']
};

/**
 * Returns the default sidebar expansion state for first launch.
 */
export function defaultSidebarExpansion(): SidebarExpansionState {
  return {
    sections: { ...DEFAULT_SECTIONS },
    activeSidebarMode: DEFAULT_ACTIVE_SIDEBAR_MODE,
    sidebarRailExpanded: DEFAULT_SIDEBAR_RAIL_EXPANDED,
    sectionSort: { ...DEFAULT_SECTION_SORT },
    collectionIds: [],
    folderIds: [],
    environmentIds: [],
    showStorageLocationBadges: DEFAULT_SHOW_STORAGE_LOCATION_BADGES,
    showMarkers: DEFAULT_SHOW_MARKERS,
    showMethodColors: DEFAULT_SHOW_METHOD_COLORS,
    showIndicators: DEFAULT_SHOW_INDICATORS,
    showFilters: DEFAULT_SHOW_FILTERS,
    showSorting: DEFAULT_SHOW_SORTING
  };
}

/**
 * Normalizes a raw id list to positive integers with duplicates removed.
 *
 * @param value - Raw stored value.
 */
function normalizeIdList(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<number>();
  const ids: number[] = [];

  for (const item of value) {
    if (typeof item !== 'number' || !Number.isInteger(item) || item <= 0) {
      continue;
    }
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);
    ids.push(item);
  }

  return ids;
}

/**
 * Returns whether a value is a known {@link SidebarSortMode}.
 *
 * @param value - Raw stored value.
 */
function isSidebarSortMode(value: unknown): value is SidebarSortMode {
  return typeof value === 'string' && (SIDEBAR_SORT_MODES as readonly string[]).includes(value);
}

/**
 * Returns whether a value is a known {@link SidebarMode}.
 *
 * @param value - Raw stored value.
 */
function isSidebarMode(value: unknown): value is SidebarMode {
  return typeof value === 'string' && (SIDEBAR_MODES as readonly string[]).includes(value);
}

/**
 * Reads a boolean section preference, preferring the renamed `workspaces` key and
 * falling back to the legacy `tabGroups` key from older persisted blobs.
 *
 * @param raw - Partial sections or legacy sectionVisibility object.
 * @param fallback - Default when neither key is a boolean.
 */
function readWorkspacesBoolean(
  raw: Partial<Record<string, unknown>> | undefined,
  fallback: boolean
): boolean {
  if (raw && typeof raw.workspaces === 'boolean') {
    return raw.workspaces;
  }
  if (raw && typeof raw.tabGroups === 'boolean') {
    return raw.tabGroups;
  }
  return fallback;
}

/**
 * Derives an activity-rail mode from a legacy multi-boolean `sectionVisibility` blob.
 *
 * Rule: `trash` only when trash is visible and the four primary modes are all
 * hidden; otherwise first match among workflows → workspaces → environments →
 * collections (default).
 *
 * @param visibilityRaw - Legacy sectionVisibility object, if present.
 * @returns Migrated {@link SidebarMode}.
 */
function deriveModeFromLegacyVisibility(
  visibilityRaw: Partial<Record<string, unknown>> | undefined
): SidebarMode {
  if (!visibilityRaw) {
    return DEFAULT_ACTIVE_SIDEBAR_MODE;
  }

  const collections = visibilityRaw.collections === true;
  const environments = visibilityRaw.environments === true;
  const workspaces = readWorkspacesBoolean(visibilityRaw, false);
  const workflows = visibilityRaw.workflows === true;
  const trash = visibilityRaw.trash === true;

  if (trash && !collections && !environments && !workspaces && !workflows) {
    return 'trash';
  }
  if (workflows) {
    return 'workflows';
  }
  if (workspaces) {
    return 'workspaces';
  }
  if (environments) {
    return 'environments';
  }
  return 'collections';
}

/**
 * Resolves the active sidebar mode from persisted state, migrating legacy
 * `sectionVisibility` when `activeSidebarMode` is absent.
 *
 * @param raw - Partial expansion state object.
 * @returns Normalized {@link SidebarMode}.
 */
function normalizeActiveSidebarMode(raw: Partial<Record<string, unknown>>): SidebarMode {
  if (isSidebarMode(raw.activeSidebarMode)) {
    return raw.activeSidebarMode;
  }

  const visibilityRaw = raw.sectionVisibility as Partial<Record<string, unknown>> | undefined;
  return deriveModeFromLegacyVisibility(visibilityRaw);
}

/**
 * Normalizes persisted per-section sort modes, falling back to defaults for
 * missing or unknown values. Accepts the legacy `tabGroups` key as an alias for
 * `workspaces`.
 *
 * @param value - Raw stored sectionSort object.
 */
function normalizeSectionSort(value: unknown): Record<SidebarSectionKey, SidebarSortMode> {
  const raw = value && typeof value === 'object' ? (value as Partial<Record<string, unknown>>) : {};
  const result = { ...DEFAULT_SECTION_SORT };

  for (const key of SIDEBAR_SECTION_KEYS) {
    const mode = raw[key];
    if (isSidebarSortMode(mode)) {
      result[key] = mode;
    }
  }

  if (!isSidebarSortMode(raw.workspaces) && isSidebarSortMode(raw.tabGroups)) {
    result.workspaces = raw.tabGroups;
  }

  return result;
}

/**
 * Normalizes persisted sidebar expansion state from electron-store.
 *
 * Accepts legacy `tabGroups` keys in sections and sectionSort and maps them onto
 * the renamed `workspaces` fields. Migrates legacy `sectionVisibility` booleans
 * into `activeSidebarMode` when the newer field is missing.
 *
 * @param value - Raw stored value.
 */
export function normalizeSidebarExpansion(value: unknown): SidebarExpansionState {
  if (!value || typeof value !== 'object') {
    return defaultSidebarExpansion();
  }

  const raw = value as Partial<SidebarExpansionState> & Record<string, unknown>;
  const sectionsRaw = raw.sections as Partial<Record<string, unknown>> | undefined;

  return {
    sections: {
      collections:
        sectionsRaw && typeof sectionsRaw.collections === 'boolean'
          ? sectionsRaw.collections
          : DEFAULT_SECTIONS.collections,
      environments:
        sectionsRaw && typeof sectionsRaw.environments === 'boolean'
          ? sectionsRaw.environments
          : DEFAULT_SECTIONS.environments,
      runResults:
        sectionsRaw && typeof sectionsRaw.runResults === 'boolean'
          ? sectionsRaw.runResults
          : DEFAULT_SECTIONS.runResults,
      history:
        sectionsRaw && typeof sectionsRaw.history === 'boolean'
          ? sectionsRaw.history
          : DEFAULT_SECTIONS.history,
      workspaces: readWorkspacesBoolean(sectionsRaw, DEFAULT_SECTIONS.workspaces),
      workflows:
        sectionsRaw && typeof sectionsRaw.workflows === 'boolean'
          ? sectionsRaw.workflows
          : DEFAULT_SECTIONS.workflows,
      websites:
        sectionsRaw && typeof sectionsRaw.websites === 'boolean'
          ? sectionsRaw.websites
          : DEFAULT_SECTIONS.websites,
      archive:
        sectionsRaw && typeof sectionsRaw.archive === 'boolean'
          ? sectionsRaw.archive
          : DEFAULT_SECTIONS.archive,
      trash:
        sectionsRaw && typeof sectionsRaw.trash === 'boolean'
          ? sectionsRaw.trash
          : DEFAULT_SECTIONS.trash
    },
    activeSidebarMode: normalizeActiveSidebarMode(raw),
    sidebarRailExpanded:
      typeof raw.sidebarRailExpanded === 'boolean'
        ? raw.sidebarRailExpanded
        : DEFAULT_SIDEBAR_RAIL_EXPANDED,
    sectionSort: normalizeSectionSort(raw.sectionSort),
    collectionIds: normalizeIdList(raw.collectionIds),
    folderIds: normalizeIdList(raw.folderIds),
    environmentIds: normalizeIdList(raw.environmentIds),
    showStorageLocationBadges:
      typeof raw.showStorageLocationBadges === 'boolean'
        ? raw.showStorageLocationBadges
        : DEFAULT_SHOW_STORAGE_LOCATION_BADGES,
    showMarkers: typeof raw.showMarkers === 'boolean' ? raw.showMarkers : DEFAULT_SHOW_MARKERS,
    showMethodColors:
      typeof raw.showMethodColors === 'boolean' ? raw.showMethodColors : DEFAULT_SHOW_METHOD_COLORS,
    showIndicators:
      typeof raw.showIndicators === 'boolean' ? raw.showIndicators : DEFAULT_SHOW_INDICATORS,
    showFilters: typeof raw.showFilters === 'boolean' ? raw.showFilters : DEFAULT_SHOW_FILTERS,
    showSorting: typeof raw.showSorting === 'boolean' ? raw.showSorting : DEFAULT_SHOW_SORTING
  };
}
