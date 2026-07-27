import { describe, expect, it } from 'vitest';
import type { PluginManifest } from '@harborclient/core/plugin/types';
import { getSidebarPanelReplaces } from './sidebarPanelManifest';

/**
 * Builds a minimal manifest for sidebar panel lookup tests.
 *
 * @param sidebarPanels - Optional sidebar panel contributions.
 * @returns A plugin manifest fixture.
 */
function manifestWithPanels(
  sidebarPanels: NonNullable<PluginManifest['contributes']>['sidebarPanels']
): PluginManifest {
  return {
    id: 'com.example.test',
    name: 'Test',
    version: '1.0.0',
    engines: { harborclient: '>=1.0.0' },
    permissions: ['ui'],
    contributes: sidebarPanels ? { sidebarPanels } : undefined
  };
}

describe('getSidebarPanelReplaces', () => {
  it('returns collections when the manifest entry declares replaces', () => {
    const manifest = manifestWithPanels([
      { id: 'my.collections', title: 'My Collections', replaces: 'collections' }
    ]);
    expect(getSidebarPanelReplaces(manifest, 'my.collections')).toBe('collections');
  });

  it('returns undefined when the entry omits replaces', () => {
    const manifest = manifestWithPanels([{ id: 'my.panel', title: 'Panel' }]);
    expect(getSidebarPanelReplaces(manifest, 'my.panel')).toBeUndefined();
  });

  it('returns undefined when the contribution id is missing', () => {
    const manifest = manifestWithPanels([
      { id: 'my.collections', title: 'My Collections', replaces: 'collections' }
    ]);
    expect(getSidebarPanelReplaces(manifest, 'other.panel')).toBeUndefined();
  });
});
