import type { SidebarExpansionState } from '#/shared/types';

const DEFAULT_SECTIONS = {
  collections: true,
  environments: true
} as const;

/**
 * Returns the default sidebar expansion state for first launch.
 */
export function defaultSidebarExpansion(): SidebarExpansionState {
  return {
    sections: { ...DEFAULT_SECTIONS },
    collectionIds: [],
    folderIds: []
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
    collectionIds: normalizeIdList(raw.collectionIds),
    folderIds: normalizeIdList(raw.folderIds)
  };
}
