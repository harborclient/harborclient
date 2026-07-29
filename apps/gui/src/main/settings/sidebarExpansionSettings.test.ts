import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSidebarExpansion } from '@harborclient/core/sidebarExpansion';

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
    const defaults = defaultSidebarExpansion();

    expect(getSidebarExpansion()).toEqual(defaults);
    expect(mockGet).toHaveBeenCalledWith('sidebarExpansion', defaults);
  });

  it('reads and normalizes persisted state', async () => {
    mockGet.mockReturnValue({
      sections: { collections: false, environments: false },
      collectionIds: [1, 1, -1],
      folderIds: [9],
      environmentIds: []
    });
    const { getSidebarExpansion } = await import('#/main/settings/sidebarExpansionSettings');

    expect(getSidebarExpansion()).toEqual({
      ...defaultSidebarExpansion(),
      sections: {
        ...defaultSidebarExpansion().sections,
        collections: false,
        environments: false
      },
      collectionIds: [1],
      folderIds: [9]
    });
  });

  it('persists normalized state', async () => {
    const { setSidebarExpansion } = await import('#/main/settings/sidebarExpansionSettings');

    setSidebarExpansion({
      ...defaultSidebarExpansion(),
      sections: {
        ...defaultSidebarExpansion().sections,
        collections: true,
        environments: false
      },
      activeSidebarMode: 'environments',
      sidebarRailExpanded: true,
      collectionIds: [2, 2, -3],
      folderIds: [8],
      showStorageLocationBadges: false
    });

    expect(mockSet).toHaveBeenCalledWith('sidebarExpansion', {
      ...defaultSidebarExpansion(),
      sections: {
        ...defaultSidebarExpansion().sections,
        collections: true,
        environments: false
      },
      activeSidebarMode: 'environments',
      sidebarRailExpanded: true,
      collectionIds: [2],
      folderIds: [8],
      showStorageLocationBadges: false
    });
  });
});
