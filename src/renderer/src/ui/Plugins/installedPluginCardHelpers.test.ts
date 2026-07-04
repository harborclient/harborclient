import { describe, expect, it } from 'vitest';
import type { PluginInfo } from '#/shared/plugin/types';
import {
  installedCardToggleLabel,
  resolveInstalledCardMiddleAction
} from '#/renderer/src/ui/Plugins/installedPluginCardHelpers';

/**
 * Builds a minimal installed plugin row for card helper tests.
 */
function pluginInfo(source: PluginInfo['source']): PluginInfo {
  return {
    id: 'com.example.test',
    name: 'Test',
    version: '1.0.0',
    enabled: true,
    path: '/tmp/test',
    source,
    permissions: [],
    manifest: {
      id: 'com.example.test',
      name: 'Test',
      version: '1.0.0',
      engines: { harborclient: '>=1.0.0' },
      permissions: []
    }
  };
}

describe('resolveInstalledCardMiddleAction', () => {
  it('returns update for git-installed plugins', () => {
    expect(resolveInstalledCardMiddleAction(pluginInfo('git'))).toBe('update');
  });

  it('returns reload for unpacked dev plugins', () => {
    expect(resolveInstalledCardMiddleAction(pluginInfo('unpacked'))).toBe('reload');
  });

  it('returns null for file-installed plugins', () => {
    expect(resolveInstalledCardMiddleAction(pluginInfo('installed'))).toBeNull();
  });
});

describe('installedCardToggleLabel', () => {
  it('returns Disable when the plugin is enabled', () => {
    expect(installedCardToggleLabel(true)).toBe('Disable');
  });

  it('returns Enable when the plugin is disabled', () => {
    expect(installedCardToggleLabel(false)).toBe('Enable');
  });
});
