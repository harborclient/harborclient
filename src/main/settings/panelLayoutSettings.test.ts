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

describe('panelLayoutSettings', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGet.mockReset();
    mockSet.mockReset();
    mockGet.mockReturnValue(undefined);
  });

  it('returns defaults when unset', async () => {
    const { getPanelLayout } = await import('#/main/settings/panelLayoutSettings');

    expect(getPanelLayout()).toEqual({
      showSidebar: true,
      showAiSidebar: false
    });
  });

  it('persists normalized layout state', async () => {
    const { setPanelLayout } = await import('#/main/settings/panelLayoutSettings');

    setPanelLayout({ showSidebar: false, showAiSidebar: true });

    expect(mockSet).toHaveBeenCalledWith('panelLayout', {
      showSidebar: false,
      showAiSidebar: true
    });
  });
});
