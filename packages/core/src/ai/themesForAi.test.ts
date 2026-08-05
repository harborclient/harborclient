import { describe, expect, it } from 'vitest';
import { listThemesForAi, resolveThemeSelection, type AiThemeInventory } from './themesForAi.js';

/**
 * Builds a theme inventory for list/resolve tests.
 *
 * @param overrides - Partial inventory fields.
 */
function inventory(overrides: Partial<AiThemeInventory> = {}): AiThemeInventory {
  return {
    activeTheme: 'dark',
    customThemes: [],
    pluginThemes: [],
    ...overrides
  };
}

describe('listThemesForAi', () => {
  it('lists system and the built-ins in View menu order', () => {
    expect(listThemesForAi(inventory()).map((option) => option.value)).toEqual([
      'system',
      'light',
      'dark',
      'high-contrast'
    ]);
  });

  it('flags exactly the active theme', () => {
    const options = listThemesForAi(inventory({ activeTheme: 'light' }));
    expect(options.filter((option) => option.isActive).map((option) => option.value)).toEqual([
      'light'
    ]);
  });

  it('appends custom and plugin themes with prefixed values', () => {
    const options = listThemesForAi(
      inventory({
        customThemes: [{ id: 'ocean', title: 'Ocean', type: 'dark' }],
        pluginThemes: [{ pluginId: 'acme', id: 'neon', title: 'Neon' }]
      })
    );

    expect(options.slice(4)).toEqual([
      { value: 'custom:ocean', label: 'Ocean', kind: 'custom', type: 'dark', isActive: false },
      { value: 'plugin:acme:neon', label: 'Neon', kind: 'plugin', isActive: false }
    ]);
  });

  it('omits seeded built-in records so built-ins are not listed twice', () => {
    const options = listThemesForAi(
      inventory({
        customThemes: [
          { id: 'light', title: 'Light', type: 'light', builtin: true },
          { id: 'ocean', title: 'Ocean', type: 'dark' }
        ]
      })
    );

    expect(options.filter((option) => option.value === 'light')).toHaveLength(1);
    expect(options.map((option) => option.value)).toContain('custom:ocean');
  });

  it('marks an active custom theme', () => {
    const options = listThemesForAi(
      inventory({
        activeTheme: 'custom:ocean',
        customThemes: [{ id: 'ocean', title: 'Ocean', type: 'dark' }]
      })
    );

    expect(options.find((option) => option.isActive)?.value).toBe('custom:ocean');
  });
});

describe('resolveThemeSelection', () => {
  const options = listThemesForAi(
    inventory({
      customThemes: [{ id: 'ocean', title: 'Ocean', type: 'dark' }],
      pluginThemes: [{ pluginId: 'acme', id: 'neon', title: 'Neon' }]
    })
  );

  it('matches an exact ThemeSource value', () => {
    expect(resolveThemeSelection('custom:ocean', options)).toMatchObject({
      value: 'custom:ocean'
    });
  });

  it('matches a display label case-insensitively', () => {
    expect(resolveThemeSelection('ocean', options)).toMatchObject({ value: 'custom:ocean' });
    expect(resolveThemeSelection('High contrast', options)).toMatchObject({
      value: 'high-contrast'
    });
  });

  it('tolerates a trailing theme or mode word', () => {
    expect(resolveThemeSelection('light theme', options)).toMatchObject({ value: 'light' });
    expect(resolveThemeSelection('Dark Mode', options)).toMatchObject({ value: 'dark' });
  });

  it('rejects an empty selection', () => {
    expect(resolveThemeSelection('   ', options)).toEqual({
      error: 'Provide a theme name or value. Call list_themes to see the options.'
    });
  });

  it('rejects an unknown theme and lists the valid values', () => {
    const result = resolveThemeSelection('solarized', options);
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('Unknown theme: solarized');
    expect((result as { error: string }).error).toContain('custom:ocean');
  });

  it('rejects an ambiguous label instead of guessing', () => {
    const ambiguous = listThemesForAi(
      inventory({
        customThemes: [
          { id: 'ocean-a', title: 'Ocean', type: 'dark' },
          { id: 'ocean-b', title: 'Ocean', type: 'light' }
        ]
      })
    );

    const result = resolveThemeSelection('Ocean', ambiguous);
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('matches more than one theme');
  });
});
