import { describe, expect, it } from 'vitest';
import { defaultSidebarExpansion, normalizeSidebarExpansion } from '#/shared/sidebarExpansion';

describe('defaultSidebarExpansion', () => {
  it('starts with all sections expanded and empty tree ids', () => {
    expect(defaultSidebarExpansion()).toEqual({
      sections: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        tabGroups: true
      },
      sectionVisibility: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        tabGroups: true
      },
      collectionIds: [],
      folderIds: [],
      showStorageLocationBadges: true
    });
  });
});

describe('normalizeSidebarExpansion', () => {
  it('returns defaults for invalid input', () => {
    expect(normalizeSidebarExpansion(null)).toEqual(defaultSidebarExpansion());
    expect(normalizeSidebarExpansion('bad')).toEqual(defaultSidebarExpansion());
  });

  it('coerces section booleans and filters invalid ids', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: false, environments: 'yes' },
        collectionIds: [1, 1, -2, 3.5, '4', 2],
        folderIds: [10, 0, -1]
      })
    ).toEqual({
      sections: {
        collections: false,
        environments: true,
        runResults: true,
        history: true,
        tabGroups: true
      },
      sectionVisibility: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        tabGroups: true
      },
      collectionIds: [1, 2],
      folderIds: [10],
      showStorageLocationBadges: true
    });
  });

  it('preserves valid persisted state', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: false },
        collectionIds: [5, 7],
        folderIds: [12]
      })
    ).toEqual({
      sections: {
        collections: true,
        environments: false,
        runResults: true,
        history: true,
        tabGroups: true
      },
      sectionVisibility: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        tabGroups: true
      },
      collectionIds: [5, 7],
      folderIds: [12],
      showStorageLocationBadges: true
    });
  });

  it('preserves persisted section visibility flags', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: true },
        sectionVisibility: { collections: false, environments: true },
        collectionIds: [],
        folderIds: []
      })
    ).toEqual({
      sections: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        tabGroups: true
      },
      sectionVisibility: {
        collections: false,
        environments: true,
        runResults: true,
        history: true,
        tabGroups: true
      },
      collectionIds: [],
      folderIds: [],
      showStorageLocationBadges: true
    });
  });

  it('preserves persisted storage badge visibility flag', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: true },
        sectionVisibility: { collections: true, environments: true },
        collectionIds: [],
        folderIds: [],
        showStorageLocationBadges: false
      })
    ).toEqual({
      sections: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        tabGroups: true
      },
      sectionVisibility: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        tabGroups: true
      },
      collectionIds: [],
      folderIds: [],
      showStorageLocationBadges: false
    });
  });
});
