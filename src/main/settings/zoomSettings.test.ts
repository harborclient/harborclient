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

describe('zoomSettings', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGet.mockReset();
    mockSet.mockReset();
    mockGet.mockReturnValue(undefined);
  });

  it('returns the default zoom factor when unset', async () => {
    const { getPersistedZoomFactor } = await import('#/main/settings/zoomSettings');

    expect(getPersistedZoomFactor()).toBe(1);
  });

  it('returns normalized persisted zoom factors', async () => {
    mockGet.mockReturnValue(0.8);
    const { getPersistedZoomFactor } = await import('#/main/settings/zoomSettings');

    expect(getPersistedZoomFactor()).toBe(0.8);
  });

  it('clamps persisted zoom factors to supported bounds', async () => {
    mockGet.mockReturnValue(10);
    const { getPersistedZoomFactor } = await import('#/main/settings/zoomSettings');

    expect(getPersistedZoomFactor()).toBe(5);
  });

  it('rejects non-finite persisted zoom factors', async () => {
    mockGet.mockReturnValue('invalid');
    const { getPersistedZoomFactor } = await import('#/main/settings/zoomSettings');

    expect(getPersistedZoomFactor()).toBe(1);
  });

  it('persists normalized zoom factors', async () => {
    const { setPersistedZoomFactor } = await import('#/main/settings/zoomSettings');

    setPersistedZoomFactor(0.85);

    expect(mockSet).toHaveBeenCalledWith('zoomFactor', 0.9);
  });

  it('clamps writes to supported bounds', async () => {
    const { setPersistedZoomFactor } = await import('#/main/settings/zoomSettings');

    setPersistedZoomFactor(0.1);

    expect(mockSet).toHaveBeenCalledWith('zoomFactor', 0.3);
  });
});
