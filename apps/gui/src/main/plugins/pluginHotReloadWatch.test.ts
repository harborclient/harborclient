import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectPluginHotReloadWatchTargets } from './pluginHotReloadWatch';
import type { PluginManifest } from '#/shared/plugin/types';

const cleanups: Array<() => void> = [];

/**
 * Creates a temporary plugin directory for watch-target tests.
 */
function createPluginDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'harborclient-hot-reload-'));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/**
 * Builds a minimal manifest for hot reload watch tests.
 *
 * @param overrides - Manifest fields to merge into the base fixture.
 */
function baseManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: 'com.example.plugin',
    name: 'Example',
    version: '1.0.0',
    engines: { harborclient: '>=1.0.0' },
    renderer: 'dist/renderer.js',
    permissions: ['ui'],
    ...overrides
  };
}

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe('collectPluginHotReloadWatchTargets', () => {
  it('includes manifest assets and parent directories', () => {
    const pluginRoot = createPluginDir();
    mkdirSync(join(pluginRoot, 'dist'), { recursive: true });
    mkdirSync(join(pluginRoot, 'assets', 'screenshots'), { recursive: true });
    writeFileSync(join(pluginRoot, 'dist', 'renderer.js'), 'export function activate() {}');
    writeFileSync(join(pluginRoot, 'README.md'), '# Plugin');
    writeFileSync(join(pluginRoot, 'assets', 'icon.png'), 'png');
    writeFileSync(join(pluginRoot, 'assets', 'screenshots', 'settings.png'), 'png');

    const manifest = baseManifest({
      description: 'README.md',
      icon: 'assets/icon.png',
      screenshots: [{ path: 'assets/screenshots/settings.png', caption: 'Settings' }]
    });

    const targets = collectPluginHotReloadWatchTargets(pluginRoot, manifest);

    expect(targets.files).toEqual(
      expect.arrayContaining([
        join(pluginRoot, 'manifest.json'),
        join(pluginRoot, 'README.md'),
        join(pluginRoot, 'dist', 'renderer.js'),
        join(pluginRoot, 'assets', 'icon.png'),
        join(pluginRoot, 'assets', 'screenshots', 'settings.png')
      ])
    );
    expect(targets.directories).toEqual(
      expect.arrayContaining([
        pluginRoot,
        join(pluginRoot, 'dist'),
        join(pluginRoot, 'assets'),
        join(pluginRoot, 'assets', 'screenshots')
      ])
    );
  });

  it('includes stylesheet paths referenced in entry bundles', () => {
    const pluginRoot = createPluginDir();
    mkdirSync(join(pluginRoot, 'dist'), { recursive: true });
    writeFileSync(
      join(pluginRoot, 'dist', 'renderer.js'),
      `export function activate(hc) {
        hc.themes.register({ id: 'dark', title: 'Dark', type: 'dark', stylesheet: 'dist/theme.css' });
      }`
    );

    const targets = collectPluginHotReloadWatchTargets(pluginRoot, baseManifest());

    expect(targets.files).toContain(join(pluginRoot, 'dist', 'theme.css'));
    expect(targets.directories).toContain(join(pluginRoot, 'dist'));
  });

  it('skips manifest asset paths that escape the plugin directory', () => {
    const pluginRoot = createPluginDir();
    mkdirSync(join(pluginRoot, 'dist'), { recursive: true });
    writeFileSync(join(pluginRoot, 'dist', 'renderer.js'), 'export function activate() {}');

    const manifest = baseManifest({
      icon: '../../outside.png'
    });

    const targets = collectPluginHotReloadWatchTargets(pluginRoot, manifest);

    expect(targets.files).not.toContain(join(pluginRoot, '..', '..', 'outside.png'));
    expect(targets.files).toEqual(
      expect.arrayContaining([
        join(pluginRoot, 'manifest.json'),
        join(pluginRoot, 'dist', 'renderer.js')
      ])
    );
  });
});
