import type { SidebarExpansionState } from '#/shared/types/settings';

const DEFAULT_SECTIONS = {
  collections: true,
  environments: true
} as const;

const DEFAULT_SECTION_VISIBILITY = {
  collections: true,
  environments: true
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
          : DEFAULT_SECTIONS.environments
    },
    sectionVisibility: {
      collections:
        visibilityRaw && typeof visibilityRaw.collections === 'boolean'
          ? visibilityRaw.collections
          : DEFAULT_SECTION_VISIBILITY.collections,
      environments:
        visibilityRaw && typeof visibilityRaw.environments === 'boolean'
          ? visibilityRaw.environments
          : DEFAULT_SECTION_VISIBILITY.environments
    },
    collectionIds: normalizeIdList(raw.collectionIds),
    folderIds: normalizeIdList(raw.folderIds),
    showStorageLocationBadges:
      typeof raw.showStorageLocationBadges === 'boolean'
        ? raw.showStorageLocationBadges
        : DEFAULT_SHOW_STORAGE_LOCATION_BADGES
  };
}
