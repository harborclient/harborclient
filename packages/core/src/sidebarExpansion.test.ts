import { describe, expect, it } from 'vitest';
import { defaultSidebarExpansion, normalizeSidebarExpansion } from './sidebarExpansion';

describe('defaultSidebarExpansion', () => {
  it('starts with all sections expanded and empty tree ids', () => {
    expect(defaultSidebarExpansion()).toEqual({
      sections: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: true,
        trash: true
      },
      sectionVisibility: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: false,
        trash: false
      },
      collectionIds: [],
      folderIds: [],
      environmentIds: [],
      sectionSort: {
        collections: 'default',
        environments: 'default',
        runResults: 'default',
        history: 'default',
        workspaces: 'default',
        workflows: 'default',
        archive: 'default',
        trash: 'default'
      },
      showStorageLocationBadges: true,
      showMarkers: true,
      showMethodColors: true,
      showIndicators: true,
      showFilters: false,
      showSorting: false
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
        folderIds: [10, 0, -1],
        environmentIds: []
      })
    ).toEqual({
      sections: {
        collections: false,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: true,
        trash: true
      },
      sectionVisibility: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: false,
        trash: false
      },
      collectionIds: [1, 2],
      folderIds: [10],
      environmentIds: [],
      sectionSort: {
        collections: 'default',
        environments: 'default',
        runResults: 'default',
        history: 'default',
        workspaces: 'default',
        workflows: 'default',
        archive: 'default',
        trash: 'default'
      },
      showStorageLocationBadges: true,
      showMarkers: true,
      showMethodColors: true,
      showIndicators: true,
      showFilters: false,
      showSorting: false
    });
  });

  it('preserves valid persisted state', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: false },
        collectionIds: [5, 7],
        folderIds: [12],
        environmentIds: []
      })
    ).toEqual({
      sections: {
        collections: true,
        environments: false,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: true,
        trash: true
      },
      sectionVisibility: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: false,
        trash: false
      },
      collectionIds: [5, 7],
      folderIds: [12],
      environmentIds: [],
      sectionSort: {
        collections: 'default',
        environments: 'default',
        runResults: 'default',
        history: 'default',
        workspaces: 'default',
        workflows: 'default',
        archive: 'default',
        trash: 'default'
      },
      showStorageLocationBadges: true,
      showMarkers: true,
      showMethodColors: true,
      showIndicators: true,
      showFilters: false,
      showSorting: false
    });
  });

  it('preserves persisted section visibility flags', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: true },
        sectionVisibility: { collections: false, environments: true },
        collectionIds: [],
        folderIds: [],
        environmentIds: []
      })
    ).toEqual({
      sections: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: true,
        trash: true
      },
      sectionVisibility: {
        collections: false,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: false,
        trash: false
      },
      collectionIds: [],
      folderIds: [],
      environmentIds: [],
      sectionSort: {
        collections: 'default',
        environments: 'default',
        runResults: 'default',
        history: 'default',
        workspaces: 'default',
        workflows: 'default',
        archive: 'default',
        trash: 'default'
      },
      showStorageLocationBadges: true,
      showMarkers: true,
      showMethodColors: true,
      showIndicators: true,
      showFilters: false,
      showSorting: false
    });
  });

  it('preserves persisted storage badge visibility flag', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: true },
        sectionVisibility: { collections: true, environments: true },
        collectionIds: [],
        folderIds: [],
        environmentIds: [],
        showStorageLocationBadges: false
      })
    ).toEqual({
      sections: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: true,
        trash: true
      },
      sectionVisibility: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: false,
        trash: false
      },
      collectionIds: [],
      folderIds: [],
      environmentIds: [],
      sectionSort: {
        collections: 'default',
        environments: 'default',
        runResults: 'default',
        history: 'default',
        workspaces: 'default',
        workflows: 'default',
        archive: 'default',
        trash: 'default'
      },
      showStorageLocationBadges: false,
      showMarkers: true,
      showMethodColors: true,
      showIndicators: true,
      showFilters: false,
      showSorting: false
    });
  });

  it('preserves persisted marker dot visibility flag', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: true },
        sectionVisibility: { collections: true, environments: true },
        collectionIds: [],
        folderIds: [],
        environmentIds: [],
        showMarkers: false
      })
    ).toEqual({
      sections: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: true,
        trash: true
      },
      sectionVisibility: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: false,
        trash: false
      },
      collectionIds: [],
      folderIds: [],
      environmentIds: [],
      sectionSort: {
        collections: 'default',
        environments: 'default',
        runResults: 'default',
        history: 'default',
        workspaces: 'default',
        workflows: 'default',
        archive: 'default',
        trash: 'default'
      },
      showStorageLocationBadges: true,
      showMarkers: false,
      showMethodColors: true,
      showIndicators: true,
      showFilters: false,
      showSorting: false
    });
  });

  it('preserves persisted method marker visibility flag', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: true },
        sectionVisibility: { collections: true, environments: true },
        collectionIds: [],
        folderIds: [],
        environmentIds: [],
        showMethodColors: false
      })
    ).toEqual({
      sections: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: true,
        trash: true
      },
      sectionVisibility: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: false,
        trash: false
      },
      collectionIds: [],
      folderIds: [],
      environmentIds: [],
      sectionSort: {
        collections: 'default',
        environments: 'default',
        runResults: 'default',
        history: 'default',
        workspaces: 'default',
        workflows: 'default',
        archive: 'default',
        trash: 'default'
      },
      showStorageLocationBadges: true,
      showMarkers: true,
      showMethodColors: false,
      showIndicators: true,
      showFilters: false,
      showSorting: false
    });
  });

  it('preserves persisted indicator visibility flag', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: true },
        sectionVisibility: { collections: true, environments: true },
        collectionIds: [],
        folderIds: [],
        environmentIds: [],
        showIndicators: false
      })
    ).toEqual({
      sections: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: true,
        trash: true
      },
      sectionVisibility: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: false,
        trash: false
      },
      collectionIds: [],
      folderIds: [],
      environmentIds: [],
      sectionSort: {
        collections: 'default',
        environments: 'default',
        runResults: 'default',
        history: 'default',
        workspaces: 'default',
        workflows: 'default',
        archive: 'default',
        trash: 'default'
      },
      showStorageLocationBadges: true,
      showMarkers: true,
      showMethodColors: true,
      showIndicators: false,
      showFilters: false,
      showSorting: false
    });
  });

  it('preserves persisted filter and sorting visibility flags', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: true },
        sectionVisibility: { collections: true, environments: true },
        collectionIds: [],
        folderIds: [],
        environmentIds: [],
        showFilters: true,
        showSorting: true
      })
    ).toEqual({
      sections: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: true,
        trash: true
      },
      sectionVisibility: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: false,
        trash: false
      },
      collectionIds: [],
      folderIds: [],
      environmentIds: [],
      sectionSort: {
        collections: 'default',
        environments: 'default',
        runResults: 'default',
        history: 'default',
        workspaces: 'default',
        workflows: 'default',
        archive: 'default',
        trash: 'default'
      },
      showStorageLocationBadges: true,
      showMarkers: true,
      showMethodColors: true,
      showIndicators: true,
      showFilters: true,
      showSorting: true
    });
  });

  it('preserves valid section sort modes and falls back for unknown values', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: true },
        sectionVisibility: { collections: true, environments: true },
        collectionIds: [],
        folderIds: [],
        environmentIds: [],
        sectionSort: {
          collections: 'method-asc',
          environments: 'marker',
          runResults: 'created-desc',
          history: 'not-a-mode',
          workspaces: 'method-desc',
          archive: 'created-asc',
          trash: 42
        }
      })
    ).toEqual({
      sections: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: true,
        trash: true
      },
      sectionVisibility: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        archive: false,
        trash: false
      },
      collectionIds: [],
      folderIds: [],
      environmentIds: [],
      sectionSort: {
        collections: 'method-asc',
        environments: 'marker',
        runResults: 'created-desc',
        history: 'default',
        workspaces: 'method-desc',
        workflows: 'default',
        archive: 'created-asc',
        trash: 'default'
      },
      showStorageLocationBadges: true,
      showMarkers: true,
      showMethodColors: true,
      showIndicators: true,
      showFilters: false,
      showSorting: false
    });
  });
});
