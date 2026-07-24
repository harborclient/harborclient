import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockSet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn()
}));

vi.mock('electron-store', () => ({
  default: class MockStore {
    get = mockGet;
    set = mockSet;
  }
}));

describe('sidebarExpansionSettings', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGet.mockReset();
    mockSet.mockReset();
    mockGet.mockReturnValue(undefined);
  });

  it('returns defaults when unset', async () => {
    const { getSidebarExpansion } = await import('#/main/settings/sidebarExpansionSettings');

    expect(getSidebarExpansion()).toEqual({
      sections: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        tabGroups: true,
        trash: true
      },
      sectionVisibility: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        tabGroups: true,
        trash: false
      },
      collectionIds: [],
      folderIds: [],
      showStorageLocationBadges: true,
      showColorDots: true
    });
    expect(mockGet).toHaveBeenCalledWith('sidebarExpansion', {
      sections: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        tabGroups: true,
        trash: true
      },
      sectionVisibility: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        tabGroups: true,
        trash: false
      },
      collectionIds: [],
      folderIds: [],
      showStorageLocationBadges: true,
      showColorDots: true
    });
  });

  it('reads and normalizes persisted state', async () => {
    mockGet.mockReturnValue({
      sections: { collections: false, environments: false },
      collectionIds: [1, 1, -1],
      folderIds: [9]
    });
    const { getSidebarExpansion } = await import('#/main/settings/sidebarExpansionSettings');

    expect(getSidebarExpansion()).toEqual({
      sections: {
        collections: false,
        environments: false,
        runResults: true,
        history: true,
        tabGroups: true,
        trash: true
      },
      sectionVisibility: {
        collections: true,
        environments: true,
        runResults: true,
        history: true,
        tabGroups: true,
        trash: false
      },
      collectionIds: [1],
      folderIds: [9],
      showStorageLocationBadges: true,
      showColorDots: true
    });
  });

  it('persists normalized state', async () => {
    const { setSidebarExpansion } = await import('#/main/settings/sidebarExpansionSettings');

    setSidebarExpansion({
      sections: {
        collections: true,
        environments: false,
        runResults: true,
        history: true,
        tabGroups: true,
        trash: true
      },
      sectionVisibility: {
        collections: false,
        environments: true,
        runResults: false,
        history: true,
        tabGroups: true,
        trash: false
      },
      collectionIds: [2, 2, -3],
      folderIds: [8],
      showStorageLocationBadges: false,
      showColorDots: true
    });

    expect(mockSet).toHaveBeenCalledWith('sidebarExpansion', {
      sections: {
        collections: true,
        environments: false,
        runResults: true,
        history: true,
        tabGroups: true,
        trash: true
      },
      sectionVisibility: {
        collections: false,
        environments: true,
        runResults: false,
        history: true,
        tabGroups: true,
        trash: false
      },
      collectionIds: [2],
      folderIds: [8],
      showStorageLocationBadges: false,
      showColorDots: true
    });
  });
});
