import { describe, expect, it } from 'vitest';
import type { PluginInfo, RegisteredPluginTheme } from '#/shared/plugin/types';
import { listPluginThemeVariants } from '#/renderer/src/ui/Plugins/listPluginThemeVariants';

const PLUGIN_ID = 'com.example.solarized';

/**
 * Builds a minimal theme plugin row for variant listing tests.
 */
function themePlugin(
  overrides: Partial<PluginInfo> & { manifestThemes?: PluginInfo['manifest']['contributes'] }
): PluginInfo {
  const { manifestThemes, ...pluginOverrides } = overrides;
  return {
    id: PLUGIN_ID,
    name: 'Solarized',
    version: '1.0.0',
    enabled: true,
    path: '/tmp/solarized',
    source: 'installed',
    permissions: ['ui'],
    manifest: {
      id: PLUGIN_ID,
      name: 'Solarized',
      version: '1.0.0',
      engines: { harborclient: '>=1.0.0' },
      permissions: ['ui'],
      contributes: manifestThemes
    },
    ...pluginOverrides
  };
}

/**
 * Sample registered plugin theme used in variant listing tests.
 */
function registeredTheme(overrides: Partial<RegisteredPluginTheme> = {}): RegisteredPluginTheme {
  return {
    pluginId: PLUGIN_ID,
    id: 'light',
    title: 'Solarized Light',
    type: 'light',
    ...overrides
  };
}

describe('listPluginThemeVariants', () => {
  it('returns registered themes for an enabled plugin', () => {
    const plugin = themePlugin({});
    const registered: RegisteredPluginTheme[] = [
      registeredTheme({ id: 'light', title: 'Solarized Light', type: 'light' }),
      registeredTheme({ id: 'dark', title: 'Solarized Dark', type: 'dark' })
    ];

    expect(listPluginThemeVariants(plugin, registered)).toEqual([
      { id: 'light', title: 'Solarized Light', type: 'light' },
      { id: 'dark', title: 'Solarized Dark', type: 'dark' }
    ]);
  });

  it('returns a single registered variant', () => {
    const plugin = themePlugin({});
    const registered = [registeredTheme({ id: 'nord', title: 'Nord', type: 'dark' })];

    expect(listPluginThemeVariants(plugin, registered)).toEqual([
      { id: 'nord', title: 'Nord', type: 'dark' }
    ]);
  });

  it('falls back to manifest themes when nothing is registered', () => {
    const plugin = themePlugin({
      enabled: false,
      manifestThemes: {
        themes: [
          { id: 'light', title: 'Solarized Light', type: 'light' },
          { id: 'dark', title: 'Solarized Dark', type: 'dark' }
        ]
      }
    });

    expect(listPluginThemeVariants(plugin, [])).toEqual([
      { id: 'light', title: 'Solarized Light', type: 'light' },
      { id: 'dark', title: 'Solarized Dark', type: 'dark' }
    ]);
  });

  it('returns an empty array when no variants are declared', () => {
    const plugin = themePlugin({ enabled: false });

    expect(listPluginThemeVariants(plugin, [])).toEqual([]);
  });

  it('prefers registered themes over manifest declarations', () => {
    const plugin = themePlugin({
      manifestThemes: {
        themes: [{ id: 'manifest-only', title: 'Manifest Only', type: 'dark' }]
      }
    });
    const registered = [registeredTheme({ id: 'registered', title: 'Registered', type: 'light' })];

    expect(listPluginThemeVariants(plugin, registered)).toEqual([
      { id: 'registered', title: 'Registered', type: 'light' }
    ]);
  });
});
