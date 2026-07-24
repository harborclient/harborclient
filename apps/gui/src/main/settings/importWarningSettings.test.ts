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

describe('importWarningSettings', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGet.mockReset();
    mockSet.mockReset();
    mockGet.mockReturnValue(false);
  });

  it('returns false by default', async () => {
    const { getSuppressPostmanImportWarning } =
      await import('#/main/settings/importWarningSettings');

    expect(getSuppressPostmanImportWarning()).toBe(false);
    expect(mockGet).toHaveBeenCalledWith('suppressPostmanImportWarning', false);
  });

  it('reads persisted suppress preference', async () => {
    mockGet.mockReturnValue(true);
    const { getSuppressPostmanImportWarning } =
      await import('#/main/settings/importWarningSettings');

    expect(getSuppressPostmanImportWarning()).toBe(true);
  });

  it('persists suppress preference', async () => {
    const { setSuppressPostmanImportWarning } =
      await import('#/main/settings/importWarningSettings');

    setSuppressPostmanImportWarning(true);

    expect(mockSet).toHaveBeenCalledWith('suppressPostmanImportWarning', true);
  });
});
