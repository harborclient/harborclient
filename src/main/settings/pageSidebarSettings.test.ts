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

describe('pageSidebarSettings', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGet.mockReset();
    mockSet.mockReset();
    mockGet.mockReturnValue(undefined);
  });

  it('returns null when unset', async () => {
    const { getPageSidebarSection } = await import('#/main/settings/pageSidebarSettings');

    expect(getPageSidebarSection('settings')).toBeNull();
  });

  it('returns normalized persisted sections', async () => {
    mockGet.mockReturnValue({ settings: 'proxy', plugins: 'marketplace' });
    const { getPageSidebarSection } = await import('#/main/settings/pageSidebarSettings');

    expect(getPageSidebarSection('settings')).toBe('proxy');
    expect(getPageSidebarSection('plugins')).toBe('marketplace');
  });

  it('rejects invalid keys and sections on read', async () => {
    mockGet.mockReturnValue({ settings: 'not-a-section', unknown: 'proxy' });
    const { getPageSidebarSection } = await import('#/main/settings/pageSidebarSettings');

    expect(getPageSidebarSection('settings')).toBeNull();
    expect(getPageSidebarSection('unknown')).toBeNull();
  });

  it('persists normalized section values', async () => {
    const { setPageSidebarSection } = await import('#/main/settings/pageSidebarSettings');

    setPageSidebarSection('themes', 'install');

    expect(mockSet).toHaveBeenCalledWith('pageSidebarSections', { themes: 'install' });
  });

  it('ignores invalid writes', async () => {
    const { setPageSidebarSection } = await import('#/main/settings/pageSidebarSettings');

    setPageSidebarSection('themes', 'settings');
    setPageSidebarSection('invalid', 'proxy');

    expect(mockSet).not.toHaveBeenCalled();
  });
});
