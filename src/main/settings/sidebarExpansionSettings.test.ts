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
      sections: { collections: true, environments: true },
      collectionIds: [],
      folderIds: []
    });
    expect(mockGet).toHaveBeenCalledWith('sidebarExpansion', {
      sections: { collections: true, environments: true },
      collectionIds: [],
      folderIds: []
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
      sections: { collections: false, environments: false },
      collectionIds: [1],
      folderIds: [9]
    });
  });

  it('persists normalized state', async () => {
    const { setSidebarExpansion } = await import('#/main/settings/sidebarExpansionSettings');

    setSidebarExpansion({
      sections: { collections: true, environments: false },
      collectionIds: [2, 2, -3],
      folderIds: [8]
    });

    expect(mockSet).toHaveBeenCalledWith('sidebarExpansion', {
      sections: { collections: true, environments: false },
      collectionIds: [2],
      folderIds: [8]
    });
  });
});
