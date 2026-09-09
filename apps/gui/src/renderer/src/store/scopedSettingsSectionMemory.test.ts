import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getRememberedScopedSettingsSection,
  hydrateScopedSettingsSections,
  rememberScopedSettingsSection,
  resetScopedSettingsSectionMemoryForTests,
  resolveRememberedScopedSettingsFocusSection,
  setRememberedScopedSettingsSection
} from './scopedSettingsSectionMemory';

describe('scopedSettingsSectionMemory', () => {
  const getScopedSettingsSection = vi.fn();
  const setScopedSettingsSection = vi.fn(async () => undefined);

  beforeEach(() => {
    resetScopedSettingsSectionMemoryForTests();
    getScopedSettingsSection.mockReset();
    setScopedSettingsSection.mockClear();
    vi.stubGlobal('window', {
      api: {
        getScopedSettingsSection,
        setScopedSettingsSection
      }
    });
  });

  afterEach(() => {
    resetScopedSettingsSectionMemoryForTests();
    vi.unstubAllGlobals();
  });

  it('hydrates collection and folder sections from electron-store', async () => {
    getScopedSettingsSection.mockImplementation(async (key: string) =>
      key === 'collection' ? 'variables' : 'auth'
    );

    await hydrateScopedSettingsSections();

    expect(getRememberedScopedSettingsSection('collection')).toBe('variables');
    expect(getRememberedScopedSettingsSection('folder')).toBe('auth');
    expect(resolveRememberedScopedSettingsFocusSection('collection', undefined)).toBe('variables');
  });

  it('prefers an explicit page section over remembered memory', () => {
    setRememberedScopedSettingsSection('collection', 'headers');

    expect(resolveRememberedScopedSettingsFocusSection('collection', 'git')).toBe('git');
  });

  it('persists user tab changes to memory and electron-store', () => {
    rememberScopedSettingsSection('collection', 'discuss');

    expect(getRememberedScopedSettingsSection('collection')).toBe('discuss');
    expect(setScopedSettingsSection).toHaveBeenCalledWith('collection', 'discuss');
  });

  it('keeps defaults when hydration IPC fails', async () => {
    getScopedSettingsSection.mockRejectedValue(new Error('unavailable'));

    await hydrateScopedSettingsSections();

    expect(getRememberedScopedSettingsSection('collection')).toBeNull();
    expect(getRememberedScopedSettingsSection('folder')).toBeNull();
  });
});
