import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PluginManager } from './PluginManager';
import {
  clearLocalDatabaseForTesting,
  getLocalDatabase,
  initLocalDatabase
} from '#/main/storage/localDatabaseInstance';

const cleanups: Array<() => void | Promise<void>> = [];

/**
 * Creates an isolated plugin manager and userData directory for grant tests.
 */
async function createManager(): Promise<{ manager: PluginManager; rootDir: string }> {
  const rootDir = mkdtempSync(join(tmpdir(), 'harborclient-fs-grants-'));
  await initLocalDatabase(rootDir);
  const manager = new PluginManager(rootDir, '1.9.0');
  cleanups.push(async () => {
    manager.dispose();
    await getLocalDatabase().close();
    rmSync(rootDir, { recursive: true, force: true });
  });
  return { manager, rootDir };
}

/**
 * Writes a minimal plugin manifest and renderer entry at one directory path.
 *
 * @param pluginDir - Absolute plugin root directory.
 * @param pluginId - Plugin manifest id.
 */
function writePluginAt(pluginDir: string, pluginId: string): void {
  mkdirSync(join(pluginDir, 'dist'), { recursive: true });
  writeFileSync(
    join(pluginDir, 'manifest.json'),
    JSON.stringify(
      {
        id: pluginId,
        name: 'Grant Test',
        version: '1.0.0',
        engines: { harborclient: '>=1.0.0' },
        renderer: 'dist/renderer.js',
        permissions: ['filesystem:read', 'filesystem:pick']
      },
      null,
      2
    )
  );
  writeFileSync(join(pluginDir, 'dist', 'renderer.js'), 'export function activate() {}');
}

/**
 * Writes a minimal installed plugin under userData/plugins.
 *
 * @param rootDir - userData root directory.
 * @param pluginId - Plugin manifest id.
 */
function writePlugin(rootDir: string, pluginId: string): string {
  const pluginDir = join(rootDir, 'plugins', pluginId);
  writePluginAt(pluginDir, pluginId);
  return pluginDir;
}

beforeEach(() => {
  clearLocalDatabaseForTesting();
});

afterEach(async () => {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();
    if (cleanup) {
      await cleanup();
    }
  }
});

describe('plugin filesystem grant persistence', () => {
  it('persists user-granted paths and restores them after a new manager starts', async () => {
    const { manager, rootDir } = await createManager();
    const pluginId = 'com.example.grants';
    writePlugin(rootDir, pluginId);
    manager.discover();

    const envFile = join(rootDir, 'project.env');
    writeFileSync(envFile, 'TOKEN=abc\n');

    manager.grantFilesystemPath(pluginId, envFile);
    expect(manager.fsAllowlist.readTextFile(pluginId, envFile)).toBe('TOKEN=abc\n');
    expect(getLocalDatabase().listPluginFsGrants(pluginId)).toEqual([envFile]);

    manager.dispose();
    await getLocalDatabase().close();
    clearLocalDatabaseForTesting();

    await initLocalDatabase(rootDir);
    const restarted = new PluginManager(rootDir, '1.9.0');
    restarted.discover();

    expect(restarted.fsAllowlist.readTextFile(pluginId, envFile)).toBe('TOKEN=abc\n');

    restarted.dispose();
    await getLocalDatabase().close();
    rmSync(rootDir, { recursive: true, force: true });
  });

  it('clears persisted grants when an unpacked plugin is removed', async () => {
    const { manager, rootDir } = await createManager();
    const pluginId = 'com.example.clear';
    const pluginDir = mkdtempSync(join(tmpdir(), 'harborclient-unpacked-plugin-'));
    writePluginAt(pluginDir, pluginId);
    await manager.loadUnpacked(pluginDir);

    const envFile = join(rootDir, 'secrets.env');
    writeFileSync(envFile, 'SECRET=1\n');
    manager.grantFilesystemPath(pluginId, envFile);
    expect(getLocalDatabase().listPluginFsGrants(pluginId)).toHaveLength(1);

    manager.removeUnpacked(pluginId);
    expect(getLocalDatabase().listPluginFsGrants(pluginId)).toEqual([]);
    expect(() => manager.fsAllowlist.readTextFile(pluginId, envFile)).toThrow(/not allowlisted/);
    rmSync(pluginDir, { recursive: true, force: true });
  });

  it('re-grants linked dotenv paths saved in plugin storage after restart', async () => {
    const { manager, rootDir } = await createManager();
    const pluginId = 'com.harborclient.plugins.dotenv';
    writePlugin(rootDir, pluginId);
    manager.discover();

    const envFile = join(rootDir, 'linked.env');
    writeFileSync(envFile, 'API_KEY=linked\n');
    getLocalDatabase().setPluginValue(
      pluginId,
      'links',
      JSON.stringify([
        {
          collectionId: 1,
          dotenvPath: envFile,
          environmentId: 10,
          environmentName: 'Local env',
          keepInSync: true,
          lastSyncedHash: 'abc',
          lastSyncedAt: '2026-01-01T00:00:00.000Z'
        }
      ])
    );
    expect(getLocalDatabase().listPluginFsGrants(pluginId)).toEqual([]);

    manager.dispose();
    await getLocalDatabase().close();
    clearLocalDatabaseForTesting();

    await initLocalDatabase(rootDir);
    const restarted = new PluginManager(rootDir, '1.9.0');
    restarted.discover();

    expect(restarted.fsAllowlist.readTextFile(pluginId, envFile)).toBe('API_KEY=linked\n');
    expect(getLocalDatabase().listPluginFsGrants(pluginId)).toEqual([envFile]);

    restarted.dispose();
    await getLocalDatabase().close();
    rmSync(rootDir, { recursive: true, force: true });
  });
});
