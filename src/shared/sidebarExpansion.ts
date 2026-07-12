import type { SidebarExpansionState } from '#/shared/types/settings';

const DEFAULT_SECTIONS = {
  collections: true,
  environments: true,
  runResults: true,
  history: true,
  tabGroups: true,
  trash: true
} as const;

const DEFAULT_SECTION_VISIBILITY = {
  collections: true,
  environments: true,
  runResults: true,
  history: true,
  tabGroups: true,
  trash: false
} as const;

const DEFAULT_SHOW_STORAGE_LOCATION_BADGES = true;

/**
 * Returns the default sidebar expansion state for first launch.
 */
export function defaultSidebarExpansion(): SidebarExpansionState {
  return {
    sections: { ...DEFAULT_SECTIONS },
    sectionVisibility: { ...DEFAULT_SECTION_VISIBILITY },
    collectionIds: [],
    folderIds: [],
    showStorageLocationBadges: DEFAULT_SHOW_STORAGE_LOCATION_BADGES
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
      trash:
        visibilityRaw && typeof visibilityRaw.trash === 'boolean'
          ? visibilityRaw.trash
          : DEFAULT_SECTION_VISIBILITY.trash
    },
    collectionIds: normalizeIdList(raw.collectionIds),
    folderIds: normalizeIdList(raw.folderIds),
    showStorageLocationBadges:
      typeof raw.showStorageLocationBadges === 'boolean'
        ? raw.showStorageLocationBadges
        : DEFAULT_SHOW_STORAGE_LOCATION_BADGES
  };
}
