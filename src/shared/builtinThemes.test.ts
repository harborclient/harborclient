import { describe, expect, it } from 'vitest';
import { BUILTIN_THEME_IDS, isBuiltinThemeId, isBuiltinThemeSource } from './builtinThemes';

describe('builtinThemes', () => {
  it('lists the reserved built-in theme ids', () => {
    expect(BUILTIN_THEME_IDS).toEqual(['light', 'dark', 'high-contrast']);
  });

  it('detects built-in ids and persisted sources', () => {
    expect(isBuiltinThemeId('light')).toBe(true);
    expect(isBuiltinThemeId('custom-theme')).toBe(false);
    expect(isBuiltinThemeSource('high-contrast')).toBe(true);
    expect(isBuiltinThemeSource('system')).toBe(false);
  });
});
