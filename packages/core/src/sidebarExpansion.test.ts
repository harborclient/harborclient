import { describe, expect, it } from 'vitest';
import {
  defaultSidebarExpansion,
  normalizeSidebarExpansion,
  SIDEBAR_MODE_SECTIONS
} from './sidebarExpansion';

/**
 * Shared appearance + sort defaults used by normalize expectations.
 */
const defaultAppearanceAndSort = {
  sectionSort: {
    collections: 'default',
    environments: 'default',
    runResults: 'default',
    history: 'default',
    workspaces: 'default',
    workflows: 'default',
    websites: 'default',
    liveServers: 'default',
    liveServerLogs: 'default',
    archive: 'default',
    trash: 'default'
  },
  showStorageLocationBadges: true,
  showMarkers: true,
  showMethodColors: true,
  showIndicators: true,
  showFilters: false,
  showSorting: false
} as const;

describe('SIDEBAR_MODE_SECTIONS', () => {
  it('maps each rail mode to its section set', () => {
    expect(SIDEBAR_MODE_SECTIONS.collections).toEqual([
      'collections',
      'runResults',
      'history',
      'archive'
    ]);
    expect(SIDEBAR_MODE_SECTIONS.environments).toEqual(['environments', 'workspaces']);
    expect(SIDEBAR_MODE_SECTIONS.workflows).toEqual(['workflows', 'history', 'archive']);
    expect(SIDEBAR_MODE_SECTIONS.servers).toEqual(['liveServers', 'liveServerLogs', 'websites']);
    expect(SIDEBAR_MODE_SECTIONS.trash).toEqual(['trash']);
  });
});

describe('defaultSidebarExpansion', () => {
  it('starts with all sections expanded, collections mode, and collapsed rail', () => {
    expect(defaultSidebarExpansion()).toEqual({
      sections: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        workspaces: true,
        workflows: true,
        websites: true,
        liveServers: true,
        liveServerLogs: true,
        archive: true,
        trash: true
      },
      activeSidebarMode: 'collections',
      sidebarRailExpanded: false,
      collectionIds: [],
      folderIds: [],
      environmentIds: [],
      ...defaultAppearanceAndSort
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
        websites: true,
        liveServers: true,
        liveServerLogs: true,
        archive: true,
        trash: true
      },
      activeSidebarMode: 'collections',
      sidebarRailExpanded: false,
      collectionIds: [1, 2],
      folderIds: [10],
      environmentIds: [],
      ...defaultAppearanceAndSort
    });
  });

  it('preserves valid persisted state', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: false },
        activeSidebarMode: 'environments',
        sidebarRailExpanded: true,
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
        websites: true,
        liveServers: true,
        liveServerLogs: true,
        archive: true,
        trash: true
      },
      activeSidebarMode: 'environments',
      sidebarRailExpanded: true,
      collectionIds: [5, 7],
      folderIds: [12],
      environmentIds: [],
      ...defaultAppearanceAndSort
    });
  });

  it('migrates legacy sectionVisibility to activeSidebarMode', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: true },
        sectionVisibility: { collections: false, environments: true },
        collectionIds: [],
        folderIds: [],
        environmentIds: []
      }).activeSidebarMode
    ).toBe('environments');

    expect(
      normalizeSidebarExpansion({
        sectionVisibility: {
          collections: false,
          environments: false,
          workspaces: false,
          workflows: false,
          trash: true
        }
      }).activeSidebarMode
    ).toBe('trash');

    expect(
      normalizeSidebarExpansion({
        sectionVisibility: {
          collections: true,
          environments: true,
          workflows: true
        }
      }).activeSidebarMode
    ).toBe('workflows');

    expect(
      normalizeSidebarExpansion({
        sectionVisibility: {
          collections: false,
          environments: false,
          workspaces: true,
          workflows: false
        }
      }).activeSidebarMode
    ).toBe('environments');
  });

  it('migrates removed workspaces rail mode to environments', () => {
    expect(
      normalizeSidebarExpansion({
        activeSidebarMode: 'workspaces',
        collectionIds: [],
        folderIds: [],
        environmentIds: []
      }).activeSidebarMode
    ).toBe('environments');
  });

  it('preserves persisted storage badge visibility flag', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: true },
        collectionIds: [],
        folderIds: [],
        environmentIds: [],
        showStorageLocationBadges: false
      })
    ).toEqual({
      ...defaultSidebarExpansion(),
      showStorageLocationBadges: false
    });
  });

  it('preserves persisted marker dot visibility flag', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: true },
        collectionIds: [],
        folderIds: [],
        environmentIds: [],
        showMarkers: false
      })
    ).toEqual({
      ...defaultSidebarExpansion(),
      showMarkers: false
    });
  });

  it('preserves persisted method marker visibility flag', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: true },
        collectionIds: [],
        folderIds: [],
        environmentIds: [],
        showMethodColors: false
      })
    ).toEqual({
      ...defaultSidebarExpansion(),
      showMethodColors: false
    });
  });

  it('preserves persisted indicator visibility flag', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: true },
        collectionIds: [],
        folderIds: [],
        environmentIds: [],
        showIndicators: false
      })
    ).toEqual({
      ...defaultSidebarExpansion(),
      showIndicators: false
    });
  });

  it('preserves persisted filter and sorting visibility flags', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: true },
        collectionIds: [],
        folderIds: [],
        environmentIds: [],
        showFilters: true,
        showSorting: true
      })
    ).toEqual({
      ...defaultSidebarExpansion(),
      showFilters: true,
      showSorting: true
    });
  });

  it('preserves valid section sort modes and falls back for unknown values', () => {
    expect(
      normalizeSidebarExpansion({
        sections: { collections: true, environments: true },
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
      ...defaultSidebarExpansion(),
      sectionSort: {
        collections: 'method-asc',
        environments: 'marker',
        runResults: 'created-desc',
        history: 'default',
        workspaces: 'method-desc',
        workflows: 'default',
        websites: 'default',
        liveServers: 'default',
        liveServerLogs: 'default',
        archive: 'created-asc',
        trash: 'default'
      }
    });
  });
});
