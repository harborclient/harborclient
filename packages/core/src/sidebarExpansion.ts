import type {
  SidebarExpansionState,
  SidebarSectionKey,
  SidebarSortMode
} from './types/settings';

const DEFAULT_SECTIONS = {
  collections: true,
  environments: true,
  runResults: true,
  history: true,
  tabGroups: true,
  archive: true,
  trash: true
} as const;

const DEFAULT_SECTION_VISIBILITY = {
  collections: true,
  environments: true,
  runResults: true,
  history: true,
  tabGroups: true,
  archive: false,
  trash: false
} as const;

const DEFAULT_SECTION_SORT: Record<SidebarSectionKey, SidebarSortMode> = {
  collections: 'default',
  environments: 'default',
  runResults: 'default',
  history: 'default',
  tabGroups: 'default',
  archive: 'default',
  trash: 'default'
};

const SIDEBAR_SECTION_KEYS: readonly SidebarSectionKey[] = [
  'collections',
  'environments',
  'runResults',
  'history',
  'tabGroups',
  'archive',
  'trash'
];

const SIDEBAR_SORT_MODES: readonly SidebarSortMode[] = [
  'default',
  'name-asc',
  'name-desc',
  'created-asc',
  'created-desc',
  'color'
];

const DEFAULT_SHOW_STORAGE_LOCATION_BADGES = true;
const DEFAULT_SHOW_COLOR_DOTS = true;
const DEFAULT_SHOW_METHOD_COLORS = true;
const DEFAULT_SHOW_INDICATORS = true;

/**
 * Returns the default sidebar expansion state for first launch.
 */
export function defaultSidebarExpansion(): SidebarExpansionState {
  return {
    sections: { ...DEFAULT_SECTIONS },
    sectionVisibility: { ...DEFAULT_SECTION_VISIBILITY },
    sectionSort: { ...DEFAULT_SECTION_SORT },
    collectionIds: [],
    folderIds: [],
    showStorageLocationBadges: DEFAULT_SHOW_STORAGE_LOCATION_BADGES,
    showColorDots: DEFAULT_SHOW_COLOR_DOTS,
    showMethodColors: DEFAULT_SHOW_METHOD_COLORS,
    showIndicators: DEFAULT_SHOW_INDICATORS
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
 * Normalizes persisted per-section sort modes, falling back to defaults for
 * missing or unknown values.
 *
 * @param value - Raw stored sectionSort object.
 */
function normalizeSectionSort(value: unknown): Record<SidebarSectionKey, SidebarSortMode> {
  const raw =
    value && typeof value === 'object' ? (value as Partial<Record<SidebarSectionKey, unknown>>) : {};
  const result = { ...DEFAULT_SECTION_SORT };

  for (const key of SIDEBAR_SECTION_KEYS) {
    const mode = raw[key];
    if (isSidebarSortMode(mode)) {
      result[key] = mode;
    }
  }

  return result;
}

/**
 * Normalizes persisted sidebar expansion state from electron-store.
 *
 * @param value - Raw stored value.
 */
export function normalizeSidebarExpansion(value: unknown): SidebarExpansionState {
  if (!value || typeof value !== 'object') {
    return defaultSidebarExpansion();
  }

  const raw = value as Partial<SidebarExpansionState>;
  const sectionsRaw = raw.sections;
  const visibilityRaw = raw.sectionVisibility;

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
      tabGroups:
        sectionsRaw && typeof sectionsRaw.tabGroups === 'boolean'
          ? sectionsRaw.tabGroups
          : DEFAULT_SECTIONS.tabGroups,
      archive:
        sectionsRaw && typeof sectionsRaw.archive === 'boolean'
          ? sectionsRaw.archive
          : DEFAULT_SECTIONS.archive,
      trash:
        sectionsRaw && typeof sectionsRaw.trash === 'boolean'
          ? sectionsRaw.trash
          : DEFAULT_SECTIONS.trash
    },
    sectionVisibility: {
      collections:
        visibilityRaw && typeof visibilityRaw.collections === 'boolean'
          ? visibilityRaw.collections
          : DEFAULT_SECTION_VISIBILITY.collections,
      environments:
        visibilityRaw && typeof visibilityRaw.environments === 'boolean'
          ? visibilityRaw.environments
          : DEFAULT_SECTION_VISIBILITY.environments,
      runResults:
        visibilityRaw && typeof visibilityRaw.runResults === 'boolean'
          ? visibilityRaw.runResults
          : DEFAULT_SECTION_VISIBILITY.runResults,
      history:
        visibilityRaw && typeof visibilityRaw.history === 'boolean'
          ? visibilityRaw.history
          : DEFAULT_SECTION_VISIBILITY.history,
      tabGroups:
        visibilityRaw && typeof visibilityRaw.tabGroups === 'boolean'
          ? visibilityRaw.tabGroups
          : DEFAULT_SECTION_VISIBILITY.tabGroups,
      archive:
        visibilityRaw && typeof visibilityRaw.archive === 'boolean'
          ? visibilityRaw.archive
          : DEFAULT_SECTION_VISIBILITY.archive,
      trash:
        visibilityRaw && typeof visibilityRaw.trash === 'boolean'
          ? visibilityRaw.trash
          : DEFAULT_SECTION_VISIBILITY.trash
    },
    sectionSort: normalizeSectionSort(raw.sectionSort),
    collectionIds: normalizeIdList(raw.collectionIds),
    folderIds: normalizeIdList(raw.folderIds),
    showStorageLocationBadges:
      typeof raw.showStorageLocationBadges === 'boolean'
        ? raw.showStorageLocationBadges
        : DEFAULT_SHOW_STORAGE_LOCATION_BADGES,
    showColorDots:
      typeof raw.showColorDots === 'boolean' ? raw.showColorDots : DEFAULT_SHOW_COLOR_DOTS,
    showMethodColors:
      typeof raw.showMethodColors === 'boolean' ? raw.showMethodColors : DEFAULT_SHOW_METHOD_COLORS,
    showIndicators:
      typeof raw.showIndicators === 'boolean' ? raw.showIndicators : DEFAULT_SHOW_INDICATORS
  };
}
