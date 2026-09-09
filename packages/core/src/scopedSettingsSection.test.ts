import { describe, expect, it } from 'vitest';
import {
  isAllowedScopedSettingsSection,
  normalizeScopedSettingsScope,
  normalizeScopedSettingsSection,
  resolveScopedSettingsFocusSection
} from './scopedSettingsSection';

describe('normalizeScopedSettingsScope', () => {
  it('accepts collection and folder scopes', () => {
    expect(normalizeScopedSettingsScope('collection')).toBe('collection');
    expect(normalizeScopedSettingsScope('folder')).toBe('folder');
  });

  it('rejects unknown keys', () => {
    expect(normalizeScopedSettingsScope('settings')).toBeNull();
    expect(normalizeScopedSettingsScope(null)).toBeNull();
  });
});

describe('normalizeScopedSettingsSection', () => {
  it('accepts built-in collection settings tabs', () => {
    expect(normalizeScopedSettingsSection('variables')).toBe('variables');
    expect(normalizeScopedSettingsSection('git')).toBe('git');
    expect(normalizeScopedSettingsSection('discuss')).toBe('discuss');
    expect(normalizeScopedSettingsSection('auth')).toBe('auth');
  });

  it('accepts plugin contribution ids', () => {
    expect(normalizeScopedSettingsSection('my-plugin-tab')).toBe('my-plugin-tab');
    expect(normalizeScopedSettingsSection('plugin:demo:settings')).toBe('plugin:demo:settings');
  });

  it('rejects empty or unsafe values', () => {
    expect(normalizeScopedSettingsSection('')).toBeNull();
    expect(normalizeScopedSettingsSection('   ')).toBeNull();
    expect(normalizeScopedSettingsSection('has space')).toBeNull();
    expect(normalizeScopedSettingsSection('../escape')).toBeNull();
    expect(normalizeScopedSettingsSection(1)).toBeNull();
  });
});

describe('isAllowedScopedSettingsSection', () => {
  it('mirrors normalize allowlists', () => {
    expect(isAllowedScopedSettingsSection('headers')).toBe(true);
    expect(isAllowedScopedSettingsSection('pre')).toBe(true);
    expect(isAllowedScopedSettingsSection('not valid')).toBe(false);
  });
});

describe('resolveScopedSettingsFocusSection', () => {
  it('prefers an explicit deep-link section', () => {
    expect(resolveScopedSettingsFocusSection('git', 'variables')).toBe('git');
  });

  it('uses the remembered section when the page omits one', () => {
    expect(resolveScopedSettingsFocusSection(undefined, 'headers')).toBe('headers');
  });

  it('returns undefined when nothing is remembered', () => {
    expect(resolveScopedSettingsFocusSection(undefined, null)).toBeUndefined();
  });

  it('treats blank explicit sections as unset', () => {
    expect(resolveScopedSettingsFocusSection('  ', 'post')).toBe('post');
  });
});
