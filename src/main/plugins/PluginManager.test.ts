import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearDevRegistryForTesting,
  getPluginEnablement,
  getUnpackedPluginPaths,
  setGitPluginOrigin,
  setPluginEnabled,
  setUnpackedPluginPath
} from './devRegistry';
import { PluginManager, isDisablePluginsFlagEnabled } from './PluginManager';
import * as pluginSignature from './pluginSignature';
import {
  clearLocalDatabaseForTesting,
  getLocalDatabase,
  initLocalDatabase
} from '#/main/storage/localDatabaseInstance';

const cleanups: Array<() => void | Promise<void>> = [];

/**
 * Creates an isolated userData directory and plugin manager for tests.
 *
 * @param options - Optional session overrides passed to {@link PluginManager}.
 */
async function createManager(options?: {
  disableAllPlugins?: boolean;
}): Promise<{ manager: PluginManager; rootDir: string }> {
  const rootDir = mkdtempSync(join(tmpdir(), 'harborclient-plugins-'));
  await initLocalDatabase(rootDir);
  const manager = new PluginManager(rootDir, '1.6.2', options);
  cleanups.push(async () => {
    manager.dispose();
    await getLocalDatabase().close();
    rmSync(rootDir, { recursive: true, force: true });
  });
  return { manager, rootDir };
}

/**
 * Writes a minimal valid plugin folder for discovery tests.
 *
 * @param rootDir - userData root.
 * @param pluginId - Plugin manifest id.
 * @param options - Optional manifest and entry overrides.
 */
function writePlugin(
  rootDir: string,
  pluginId: string,
  options: {
    main?: string;
    mainSource?: string;
    permissions?: string[];
  } = {}
): string {
  const pluginDir = join(rootDir, 'plugins', pluginId);
  mkdirSync(join(pluginDir, 'dist'), { recursive: true });
  writeFileSync(
    join(pluginDir, 'manifest.json'),
    JSON.stringify(
      {
        id: pluginId,
        name: 'Sample',
        version: '1.0.0',
        engines: { harborclient: '>=1.0.0' },
        renderer: 'dist/renderer.js',
        ...(options.main ? { main: options.main } : {}),
        permissions: options.permissions ?? ['ui']
      },
      null,
      2
    )
  );
  writeFileSync(join(pluginDir, 'dist', 'renderer.js'), 'export function activate() {}');
  if (options.main) {
    writeFileSync(
      join(pluginDir, options.main),
      options.mainSource ?? 'export function activate() {}'
    );
  }
  return pluginDir;
}

const TEST_PLUGIN_ID = 'com.example.archive';

/**
 * Builds a minimal valid plugin archive buffer for install tests.
 *
 * @param extraEntries - Additional zip paths and payloads to include.
 */
async function buildPluginArchive(
  extraEntries: Array<{ path: string; content: string }> = []
): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    'manifest.json',
    JSON.stringify({
      id: TEST_PLUGIN_ID,
      name: 'Archive Plugin',
      version: '1.0.0',
      engines: { harborclient: '>=1.0.0' },
      renderer: 'dist/renderer.js',
      permissions: ['ui']
    })
  );
  zip.file('dist/renderer.js', 'export function activate() {}');
  for (const entry of extraEntries) {
    zip.file(entry.path, entry.content);
  }
  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

/**
 * Writes a plugin archive buffer to a temp file path.
 *
 * @param archive - Plugin archive contents.
 */
async function writeArchiveFile(archive: Buffer): Promise<string> {
  const archivePath = join(tmpdir(), `harborclient-plugin-${Date.now()}-${Math.random()}.hcp`);
  writeFileSync(archivePath, new Uint8Array(archive));
  cleanups.push(() => {
    rmSync(archivePath, { force: true });
  });
  return archivePath;
}

beforeEach(() => {
  clearDevRegistryForTesting();
});

afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()?.();
  }
  clearDevRegistryForTesting();
  clearLocalDatabaseForTesting();
});

describe('PluginManager', () => {
  it('discovers installed plugins', async () => {
    const { manager, rootDir } = await createManager();
    writePlugin(rootDir, 'com.example.sample');
    const plugins = manager.discover();
    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.id).toBe('com.example.sample');
  });

  it('discovers manually dropped plugins as disabled until explicitly enabled', async () => {
    const { manager, rootDir } = await createManager();
    writePlugin(rootDir, 'com.example.dropped');
    const plugins = manager.discover();
    expect(plugins[0]?.enabled).toBe(false);
    manager.setEnabled('com.example.dropped', true);
    expect(manager.get('com.example.dropped')?.enabled).toBe(true);
  });

  it('namespaces plugin storage by plugin id', async () => {
    const { manager, rootDir } = await createManager();
    writePlugin(rootDir, 'com.example.one');
    writePlugin(rootDir, 'com.example.two');
    manager.discover();
    manager.setStorageValue('com.example.one', 'enabled', true);
    manager.setStorageValue('com.example.two', 'enabled', false);
    expect(manager.getStorageValue('com.example.one', 'enabled')).toBe(true);
    expect(manager.getStorageValue('com.example.two', 'enabled')).toBe(false);
  });

  it('throws when plugin storage contains invalid JSON', async () => {
    const { manager, rootDir } = await createManager();
    writePlugin(rootDir, 'com.example.one');
    manager.discover();
    getLocalDatabase().setPluginValue('com.example.one', 'state', '{not json');
    expect(() => manager.getStorageValue('com.example.one', 'state')).toThrow(
      'Plugin com.example.one storage key "state" contains invalid JSON.'
    );
  });

  it('stores and clears runtime errors on a valid plugin', async () => {
    const { manager, rootDir } = await createManager();
    writePlugin(rootDir, 'com.example.runtime');
    manager.discover();
    manager.setEnabled('com.example.runtime', true);

    manager.setRuntimeError('com.example.runtime', 'Activation failed');
    expect(manager.get('com.example.runtime')?.runtimeError).toBe('Activation failed');

    manager.clearRuntimeError('com.example.runtime');
    expect(manager.get('com.example.runtime')?.runtimeError).toBeUndefined();
  });

  it('does not notify listeners when runtime error state is unchanged', async () => {
    const { manager, rootDir } = await createManager();
    writePlugin(rootDir, 'com.example.runtime');
    manager.discover();
    manager.setEnabled('com.example.runtime', true);

    const notifications: string[] = [];
    manager.setNotifyWindow(
      () =>
        ({
          isDestroyed: () => false,
          webContents: {
            send: (_channel: string, pluginId: string) => {
              notifications.push(pluginId);
            }
          }
        }) as import('electron').BrowserWindow
    );

    manager.clearRuntimeError('com.example.runtime');
    expect(notifications).toEqual([]);

    manager.setRuntimeError('com.example.runtime', 'Activation failed');
    expect(notifications).toEqual(['com.example.runtime']);

    manager.setRuntimeError('com.example.runtime', 'Activation failed');
    expect(notifications).toEqual(['com.example.runtime']);

    manager.clearRuntimeError('com.example.runtime');
    expect(notifications).toEqual(['com.example.runtime', 'com.example.runtime']);

    manager.clearRuntimeError('com.example.runtime');
    expect(notifications).toEqual(['com.example.runtime', 'com.example.runtime']);
  });

  it('clears runtime errors when reloading a plugin from disk', async () => {
    const { manager, rootDir } = await createManager();
    writePlugin(rootDir, 'com.example.runtime');
    manager.discover();
    manager.setEnabled('com.example.runtime', true);
    manager.setRuntimeError('com.example.runtime', 'Hook failed');

    await manager.reload('com.example.runtime');

    expect(manager.get('com.example.runtime')?.runtimeError).toBeUndefined();
  });

  it('marks git-installed plugins with repository metadata on discover', async () => {
    const { manager, rootDir } = await createManager();
    writePlugin(rootDir, 'com.example.git');
    setGitPluginOrigin('com.example.git', {
      url: 'https://github.com/example/my-plugin.git',
      ref: 'main'
    });
    const plugins = manager.discover();
    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.source).toBe('git');
    expect(plugins[0]?.repoUrl).toBe('https://github.com/example/my-plugin.git');
    expect(plugins[0]?.repoRef).toBe('main');
  });

  it('keys unpacked plugins by manifest id when the dev registry uses a legacy id', async () => {
    const { manager, rootDir } = await createManager();
    const sourceDir = join(rootDir, 'dev-plugin');
    mkdirSync(join(sourceDir, 'dist'), { recursive: true });
    writeFileSync(join(sourceDir, 'README.md'), '# Solarized\n');
    writeFileSync(
      join(sourceDir, 'manifest.json'),
      JSON.stringify({
        id: 'com.harborclient.plugins.solarized',
        name: 'Solarized Theme',
        version: '1.0.0',
        description: 'README.md',
        engines: { harborclient: '>=1.0.0' },
        renderer: 'dist/renderer.js',
        permissions: ['ui']
      })
    );
    writeFileSync(join(sourceDir, 'dist', 'renderer.js'), 'export function activate() {}');
    setUnpackedPluginPath('com.example.solarized', sourceDir);
    setPluginEnabled('com.example.solarized', true);

    const plugins = manager.discover();
    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.id).toBe('com.harborclient.plugins.solarized');
    expect(plugins[0]?.enabled).toBe(true);
    expect(manager.get('com.harborclient.plugins.solarized')).toBeDefined();
    expect(
      manager.readAsset('com.harborclient.plugins.solarized', 'README.md').content
    ).toBeTruthy();
    expect(getUnpackedPluginPaths()['com.harborclient.plugins.solarized']).toBe(sourceDir);
    expect(getUnpackedPluginPaths()['com.example.solarized']).toBeUndefined();
  });

  it('loads unpacked plugins from a source directory as disabled until enabled', async () => {
    const { manager, rootDir } = await createManager();
    const sourceDir = join(rootDir, 'dev-plugin');
    mkdirSync(join(sourceDir, 'dist'), { recursive: true });
    writeFileSync(
      join(sourceDir, 'manifest.json'),
      JSON.stringify({
        id: 'com.example.dev',
        name: 'Dev Plugin',
        version: '0.1.0',
        engines: { harborclient: '>=1.0.0' },
        renderer: 'dist/renderer.js',
        permissions: ['ui']
      })
    );
    writeFileSync(join(sourceDir, 'dist', 'renderer.js'), 'export function activate() {}');
    const info = await manager.loadUnpacked(sourceDir);
    expect(info.source).toBe('unpacked');
    expect(info.path).toBe(sourceDir);
    expect(info.enabled).toBe(false);
    expect(getPluginEnablement()['com.example.dev']).toBe(false);
  });

  it('enables a plugin after explicit confirmation', async () => {
    const { manager, rootDir } = await createManager();
    const sourceDir = join(rootDir, 'dev-plugin');
    mkdirSync(join(sourceDir, 'dist'), { recursive: true });
    writeFileSync(
      join(sourceDir, 'manifest.json'),
      JSON.stringify({
        id: 'com.example.dev',
        name: 'Dev Plugin',
        version: '0.1.0',
        engines: { harborclient: '>=1.0.0' },
        renderer: 'dist/renderer.js',
        permissions: ['ui']
      })
    );
    writeFileSync(join(sourceDir, 'dist', 'renderer.js'), 'export function activate() {}');
    const info = await manager.loadUnpacked(sourceDir);
    expect(info.enabled).toBe(false);

    const enabled = manager.setEnabled(info.id, true);

    expect(enabled.enabled).toBe(true);
    expect(getPluginEnablement()[info.id]).toBe(true);
  });

  /**
   * Writes a minimal unpacked dev plugin directory for signature bypass tests.
   *
   * @param rootDir - userData root.
   * @param pluginId - Plugin manifest id.
   * @param options - Optional manifest overrides.
   */
  function writeUnpackedDevPlugin(
    rootDir: string,
    pluginId: string,
    options: { author?: string } = {}
  ): string {
    const sourceDir = join(rootDir, pluginId);
    mkdirSync(join(sourceDir, 'dist'), { recursive: true });
    writeFileSync(
      join(sourceDir, 'manifest.json'),
      JSON.stringify({
        id: pluginId,
        name: 'Dev Plugin',
        version: '0.1.0',
        engines: { harborclient: '>=1.0.0' },
        renderer: 'dist/renderer.js',
        permissions: ['ui'],
        ...(options.author ? { author: options.author } : {})
      })
    );
    writeFileSync(join(sourceDir, 'dist', 'renderer.js'), 'export function activate() {}');
    return sourceDir;
  }

  it('loads unpacked plugins without checking publisher signatures', async () => {
    const evaluateSpy = vi.spyOn(pluginSignature, 'evaluatePluginSignature').mockResolvedValue({
      status: 'untrusted',
      author: 'HarborClient',
      error: 'This plugin claims to be published by "HarborClient", but is not signed.'
    });
    const { manager, rootDir } = await createManager();
    const sourceDir = writeUnpackedDevPlugin(rootDir, 'com.example.dev', {
      author: 'HarborClient'
    });

    const info = await manager.loadUnpacked(sourceDir);

    expect(evaluateSpy).not.toHaveBeenCalled();
    expect(info.source).toBe('unpacked');
    expect(info.signature).toBeUndefined();
    expect(manager.get(info.id)?.id).toBe('com.example.dev');
    evaluateSpy.mockRestore();
  });

  it('reloads enabled unpacked plugins without re-evaluating signatures', async () => {
    const evaluateSpy = vi.spyOn(pluginSignature, 'evaluatePluginSignature').mockResolvedValue({
      status: 'invalid',
      author: 'Example Inc.',
      error: 'Plugin signature failed verification.'
    });
    const { manager, rootDir } = await createManager();
    const sourceDir = writeUnpackedDevPlugin(rootDir, 'com.example.dev');
    const info = await manager.loadUnpacked(sourceDir);
    manager.setEnabled(info.id, true);
    evaluateSpy.mockClear();

    const reloaded = await manager.reload(info.id);

    expect(evaluateSpy).not.toHaveBeenCalled();
    expect(reloaded.enabled).toBe(true);
    expect(reloaded.signature).toBeUndefined();
    evaluateSpy.mockRestore();
  });

  it('refreshSignatures skips unpacked plugins but evaluates installed plugins', async () => {
    const evaluateSpy = vi.spyOn(pluginSignature, 'evaluatePluginSignature').mockResolvedValue({
      status: 'unsigned'
    });
    const { manager, rootDir } = await createManager();
    writePlugin(rootDir, 'com.example.installed');
    manager.discover();
    const sourceDir = writeUnpackedDevPlugin(rootDir, 'com.example.dev');
    await manager.loadUnpacked(sourceDir);
    evaluateSpy.mockClear();

    await manager.refreshSignatures();

    expect(evaluateSpy).toHaveBeenCalledTimes(1);
    expect(evaluateSpy).toHaveBeenCalledWith(
      join(rootDir, 'plugins', 'com.example.installed'),
      expect.objectContaining({ id: 'com.example.installed' })
    );
    expect(manager.get('com.example.dev')?.signature).toBeUndefined();
    expect(manager.get('com.example.installed')?.signature?.status).toBe('unsigned');
    evaluateSpy.mockRestore();
  });

  it('installs a valid plugin archive', async () => {
    const { manager } = await createManager();
    const archivePath = await writeArchiveFile(await buildPluginArchive());

    const info = await manager.installFromFile(archivePath);

    expect(info.id).toBe(TEST_PLUGIN_ID);
    expect(info.source).toBe('installed');
    expect(info.enabled).toBe(false);
    expect(info.signature?.status).toBe('unsigned');
    expect(manager.get(TEST_PLUGIN_ID)?.id).toBe(TEST_PLUGIN_ID);
  });

  it('installs a verified signed plugin archive', async () => {
    const evaluateSpy = vi.spyOn(pluginSignature, 'evaluatePluginSignature').mockResolvedValue({
      status: 'verified',
      author: 'Example Inc.',
      keyId: 'test-key'
    });
    const { manager, rootDir } = await createManager();
    const archivePath = await writeArchiveFile(await buildPluginArchive());

    const info = await manager.installFromFile(archivePath);

    expect(evaluateSpy).toHaveBeenCalled();
    expect(info.signature?.status).toBe('verified');
    expect(existsSync(join(rootDir, 'plugins', TEST_PLUGIN_ID))).toBe(true);
    evaluateSpy.mockRestore();
  });

  it('rejects plugin archives with invalid signatures and cleans up the install directory', async () => {
    vi.spyOn(pluginSignature, 'evaluatePluginSignature').mockResolvedValue({
      status: 'invalid',
      author: 'Example Inc.',
      error: 'Plugin signature failed verification.'
    });
    const { manager, rootDir } = await createManager();
    const archivePath = await writeArchiveFile(await buildPluginArchive());
    const pluginDir = join(rootDir, 'plugins', TEST_PLUGIN_ID);

    await expect(manager.installFromFile(archivePath)).rejects.toThrow(
      /signature failed verification/i
    );
    expect(existsSync(pluginDir)).toBe(false);
    expect(manager.get(TEST_PLUGIN_ID)).toBeUndefined();
    vi.restoreAllMocks();
  });

  it('rejects plugin archives from untrusted publishers and cleans up the install directory', async () => {
    vi.spyOn(pluginSignature, 'evaluatePluginSignature').mockResolvedValue({
      status: 'untrusted',
      author: 'Unknown Publisher',
      error: 'No trusted signing key is registered for publisher "Unknown Publisher".'
    });
    const { manager, rootDir } = await createManager();
    const archivePath = await writeArchiveFile(await buildPluginArchive());
    const pluginDir = join(rootDir, 'plugins', TEST_PLUGIN_ID);

    await expect(manager.installFromFile(archivePath)).rejects.toThrow(/No trusted signing key/i);
    expect(existsSync(pluginDir)).toBe(false);
    vi.restoreAllMocks();
  });

  it('rejects unsigned plugin archives claiming a trusted publisher and cleans up the install directory', async () => {
    vi.spyOn(pluginSignature, 'evaluatePluginSignature').mockResolvedValue({
      status: 'untrusted',
      author: 'HarborClient',
      error:
        'This plugin claims to be published by "HarborClient", a verified publisher, but is not signed. Only "HarborClient" can publish plugins under that name.'
    });
    const { manager, rootDir } = await createManager();
    const archivePath = await writeArchiveFile(await buildPluginArchive());
    const pluginDir = join(rootDir, 'plugins', TEST_PLUGIN_ID);

    await expect(manager.installFromFile(archivePath)).rejects.toThrow(/not signed/i);
    expect(existsSync(pluginDir)).toBe(false);
    expect(manager.get(TEST_PLUGIN_ID)).toBeUndefined();
    vi.restoreAllMocks();
  });

  it('rejects plugin archives with zip-slip paths', async () => {
    const { manager, rootDir } = await createManager();
    const archivePath = await writeArchiveFile(
      await buildPluginArchive([{ path: '../../outside.txt', content: 'pwned' }])
    );
    const outsidePath = join(rootDir, 'outside.txt');
    const pluginDir = join(rootDir, 'plugins', TEST_PLUGIN_ID);

    await expect(manager.installFromFile(archivePath)).rejects.toThrow(
      /unsafe path|escapes plugin directory/i
    );
    expect(existsSync(outsidePath)).toBe(false);
    expect(existsSync(pluginDir)).toBe(false);
  });

  it('resolveMainActivation returns disk source and manifest permissions for enabled plugins', async () => {
    const { manager, rootDir } = await createManager();
    const mainSource = 'export function activate(hc) { hc.registerBeforeSendHook(() => {}); }';
    writePlugin(rootDir, 'com.example.main', {
      main: 'dist/main.js',
      mainSource,
      permissions: ['http', 'ipc']
    });
    manager.discover();
    manager.setEnabled('com.example.main', true);

    const resolved = manager.resolveMainActivation('com.example.main');

    expect(resolved.source).toBe(mainSource);
    expect(resolved.permissions).toEqual(['http', 'ipc']);
  });

  it('resolveMainActivation rejects disabled plugins', async () => {
    const { manager, rootDir } = await createManager();
    writePlugin(rootDir, 'com.example.main', { main: 'dist/main.js' });
    manager.discover();

    expect(() => manager.resolveMainActivation('com.example.main')).toThrow(
      'Plugin com.example.main is not enabled.'
    );
  });

  it('resolveMainActivation rejects unknown plugin ids', async () => {
    const { manager } = await createManager();

    expect(() => manager.resolveMainActivation('com.example.missing')).toThrow(
      'Unknown plugin: com.example.missing'
    );
  });

  it('reports all plugins disabled when disableAllPlugins is active', async () => {
    setPluginEnabled('com.example.flagged', true);
    const { manager, rootDir } = await createManager({ disableAllPlugins: true });
    writePlugin(rootDir, 'com.example.flagged');
    const plugins = manager.discover();

    expect(plugins[0]?.enabled).toBe(false);
    expect(getPluginEnablement()['com.example.flagged']).toBe(true);
  });

  it('persists enablement but keeps plugins inactive while disableAllPlugins is active', async () => {
    const { manager, rootDir } = await createManager({ disableAllPlugins: true });
    writePlugin(rootDir, 'com.example.flagged');
    manager.discover();

    manager.setEnabled('com.example.flagged', true);

    expect(manager.get('com.example.flagged')?.enabled).toBe(false);
    expect(getPluginEnablement()['com.example.flagged']).toBe(true);
  });

  it('restores persisted enablement after a session without disableAllPlugins', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'harborclient-plugins-restore-'));
    await initLocalDatabase(rootDir);
    cleanups.push(async () => {
      await getLocalDatabase().close();
      rmSync(rootDir, { recursive: true, force: true });
    });

    setPluginEnabled('com.example.flagged', true);
    writePlugin(rootDir, 'com.example.flagged');

    const disabledManager = new PluginManager(rootDir, '1.6.2', { disableAllPlugins: true });
    disabledManager.discover();
    expect(disabledManager.get('com.example.flagged')?.enabled).toBe(false);
    disabledManager.dispose();

    const normalManager = new PluginManager(rootDir, '1.6.2');
    normalManager.discover();
    expect(normalManager.get('com.example.flagged')?.enabled).toBe(true);
    normalManager.dispose();
  });
});

describe('isDisablePluginsFlagEnabled', () => {
  it('returns true when --disable-plugins is present', () => {
    expect(isDisablePluginsFlagEnabled(['electron', '--disable-plugins'])).toBe(true);
  });

  it('returns false when --disable-plugins is absent', () => {
    expect(isDisablePluginsFlagEnabled(['electron', '--verbose'])).toBe(false);
  });
});
