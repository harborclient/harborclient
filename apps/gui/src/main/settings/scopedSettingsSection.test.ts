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

describe('scopedSettingsSection settings', () => {
  beforeEach(() => {
    vi.resetModules();
    mockGet.mockReset();
    mockSet.mockReset();
    mockGet.mockReturnValue(undefined);
  });

  it('returns null when unset', async () => {
    const { getScopedSettingsSection } = await import('#/main/settings/scopedSettingsSection');

    expect(getScopedSettingsSection('collection')).toBeNull();
  });

  it('returns normalized persisted sections', async () => {
    mockGet.mockReturnValue({ collection: 'variables', folder: 'auth' });
    const { getScopedSettingsSection } = await import('#/main/settings/scopedSettingsSection');

    expect(getScopedSettingsSection('collection')).toBe('variables');
    expect(getScopedSettingsSection('folder')).toBe('auth');
  });

  it('rejects invalid keys and sections on read', async () => {
    mockGet.mockReturnValue({ collection: 'has space', settings: 'variables' });
    const { getScopedSettingsSection } = await import('#/main/settings/scopedSettingsSection');

    expect(getScopedSettingsSection('collection')).toBeNull();
    expect(getScopedSettingsSection('settings')).toBeNull();
  });

  it('persists normalized section values', async () => {
    const { setScopedSettingsSection } = await import('#/main/settings/scopedSettingsSection');

    setScopedSettingsSection('collection', 'headers');

    expect(mockSet).toHaveBeenCalledWith('scopedSettingsSections', { collection: 'headers' });
  });

  it('ignores invalid writes', async () => {
    const { setScopedSettingsSection } = await import('#/main/settings/scopedSettingsSection');

    setScopedSettingsSection('collection', 'has space');
    setScopedSettingsSection('invalid', 'variables');

    expect(mockSet).not.toHaveBeenCalled();
  });
});
