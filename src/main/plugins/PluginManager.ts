import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  watch,
  writeFileSync
} from 'fs';
import { randomUUID } from 'crypto';
import { dirname, join, normalize, posix, relative, resolve } from 'path';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs from 'fs';
import JSZip from 'jszip';
import type { BrowserWindow } from 'electron';
import { collectPluginHotReloadWatchTargets } from '#/main/plugins/pluginHotReloadWatch';
import { validatePluginManifest } from '#/main/plugins/manifestSchema';
import { PluginFsAllowlist } from '#/main/plugins/pluginFsAllowlist';
import {
  clearPluginEnabled,
  getGitPluginOrigins,
  getPluginEnablement,
  getUnpackedPluginPaths,
  removeGitPluginOrigin,
  removeUnpackedPluginPath,
  setGitPluginOrigin,
  setPluginEnabled,
  setUnpackedPluginPath
} from '#/main/plugins/devRegistry';
import { assertSafeGitPluginUrl } from '#/main/plugins/gitPluginUrl';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import type {
  PluginAssetResult,
  PluginEntryKind,
  PluginInfo,
  PluginPermission,
  PluginSource
} from '#/shared/plugin/types';

const MANIFEST_FILENAME = 'manifest.json';
const PLUGINS_DIR = 'plugins';
const RELOAD_DEBOUNCE_MS = 300;

interface PluginRecord {
  info: PluginInfo;
  watchers: ReturnType<typeof watch>[];
}

/**
 * Parses startup dev plugin paths from env and CLI flags.
 *
 * @param argv - Process argv including Electron flags.
 * @returns Absolute plugin directories to register as unpacked.
 */
export function parseDevPluginPaths(argv: string[] = process.argv): string[] {
  const paths = new Set<string>();
  const envValue = process.env.HARBOR_PLUGINS_DEV?.trim();
  if (envValue) {
    const separator = process.platform === 'win32' ? ';' : ':';
    for (const part of envValue.split(separator)) {
      const trimmed = part.trim();
      if (trimmed) {
        paths.add(resolve(trimmed));
      }
    }
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith('--plugin-dev=')) {
      paths.add(resolve(arg.slice('--plugin-dev='.length)));
      continue;
    }
    if (arg === '--plugin-dev' && argv[index + 1]) {
      paths.add(resolve(argv[index + 1]));
      index += 1;
    }
  }

  return [...paths];
}

/**
 * Manages plugin discovery, installation, dev loading, and storage on disk.
 */
export class PluginManager {
  readonly #userDataPath: string;
  readonly #appVersion: string;
  readonly #records = new Map<string, PluginRecord>();
  readonly #reloadTimers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #fsAllowlist = new PluginFsAllowlist();
  #notifyWindow: (() => BrowserWindow | null) | null = null;

  /**
   * @param userDataPath - Electron userData directory.
   * @param appVersion - Running HarborClient semver.
   */
  constructor(userDataPath: string, appVersion: string) {
    this.#userDataPath = userDataPath;
    this.#appVersion = appVersion;
  }

  /**
   * Registers a callback used to push plugin change events to the renderer.
   *
   * @param getter - Returns the focused main window, if any.
   */
  setNotifyWindow(getter: () => BrowserWindow | null): void {
    this.#notifyWindow = getter;
  }

  /**
   * Absolute path to installed plugin packages.
   */
  get pluginsDirectory(): string {
    return join(this.#userDataPath, PLUGINS_DIR);
  }

  /**
   * Filesystem allowlist used by plugin fs IPC handlers.
   */
  get fsAllowlist(): PluginFsAllowlist {
    return this.#fsAllowlist;
  }

  /**
   * Returns granted permissions for one plugin.
   *
   * @param pluginId - Plugin manifest id.
   */
  getPluginPermissions(pluginId: string): PluginPermission[] {
    const record = this.#records.get(pluginId);
    if (!record) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }
    return record.info.permissions;
  }

  /**
   * Throws when a plugin lacks one required permission.
   *
   * @param pluginId - Plugin manifest id.
   * @param permission - Required permission flag.
   */
  assertPermission(pluginId: string, permission: PluginPermission): void {
    if (!this.getPluginPermissions(pluginId).includes(permission)) {
      throw new Error(`Plugin ${pluginId} lacks permission: ${permission}`);
    }
  }

  /**
   * Grants filesystem access to one path for a plugin.
   *
   * @param pluginId - Plugin manifest id.
   * @param targetPath - Absolute path selected by the user or plugin directory.
   */
  grantFilesystemPath(pluginId: string, targetPath: string): void {
    this.#assertPluginExists(pluginId);
    this.#fsAllowlist.grantPath(pluginId, targetPath);
  }

  /**
   * Scans installed and unpacked plugins, restoring dev registrations.
   */
  discover(): PluginInfo[] {
    this.disposeWatchers();
    this.#records.clear();
    const enablement = getPluginEnablement();
    const gitOrigins = getGitPluginOrigins();

    for (const entry of this.#scanInstalled()) {
      const origin = gitOrigins[entry.id];
      const info: PluginInfo = origin
        ? {
            ...entry,
            source: 'git',
            repoUrl: origin.url,
            repoRef: origin.ref
          }
        : entry;
      this.#records.set(info.id, {
        info: { ...info, enabled: enablement[info.id] ?? false },
        watchers: []
      });
    }

    for (const [registryKey, directory] of Object.entries(getUnpackedPluginPaths())) {
      try {
        const info = this.#loadFromDirectory(directory, 'unpacked');
        if (this.#records.has(info.id)) {
          continue;
        }

        const enabled = enablement[info.id] ?? enablement[registryKey] ?? false;
        if (registryKey !== info.id) {
          removeUnpackedPluginPath(registryKey);
          setUnpackedPluginPath(info.id, directory);
          if (enablement[registryKey] !== undefined && enablement[info.id] === undefined) {
            setPluginEnabled(info.id, enablement[registryKey]!);
            clearPluginEnabled(registryKey);
          }
        }

        this.#records.set(info.id, {
          info: { ...info, enabled },
          watchers: []
        });
      } catch (error) {
        if (this.#records.has(registryKey)) {
          continue;
        }
        this.#records.set(registryKey, {
          info: this.#brokenPluginInfo(registryKey, directory, 'unpacked', error),
          watchers: []
        });
      }
    }

    for (const record of this.#records.values()) {
      if (record.info.source === 'unpacked' && record.info.enabled) {
        this.#startWatcher(record.info.id);
      }
    }

    return this.list();
  }

  /**
   * Registers dev plugin directories from startup flags.
   *
   * @param directories - Absolute plugin source directories.
   */
  registerStartupDevPaths(directories: string[]): void {
    for (const directory of directories) {
      try {
        const info = this.loadUnpacked(directory);
        this.setEnabled(info.id, true);
      } catch (error) {
        console.error(`Failed to load dev plugin from ${directory}:`, error);
      }
    }
  }

  /**
   * Returns all known plugins sorted by name.
   */
  list(): PluginInfo[] {
    return [...this.#records.values()]
      .map((record) => record.info)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  /**
   * Returns one plugin by id.
   *
   * @param pluginId - Plugin manifest id.
   */
  get(pluginId: string): PluginInfo | undefined {
    return this.#records.get(pluginId)?.info;
  }

  /**
   * Installs a plugin from a `.hcp` or `.zip` archive path.
   *
   * @param archivePath - Absolute path to the plugin package.
   * @returns Installed plugin metadata.
   */
  async installFromFile(archivePath: string): Promise<PluginInfo> {
    const buffer = readFileSync(archivePath);
    const zip = await JSZip.loadAsync(new Uint8Array(buffer));
    const manifestEntry = zip.file(MANIFEST_FILENAME);
    if (!manifestEntry) {
      throw new Error('Plugin archive is missing manifest.json.');
    }

    let manifestRaw: unknown;
    try {
      manifestRaw = JSON.parse(await manifestEntry.async('string'));
    } catch {
      throw new Error('Plugin manifest is not valid JSON.');
    }

    const manifest = validatePluginManifest(manifestRaw, this.#appVersion);
    removeUnpackedPluginPath(manifest.id);
    removeGitPluginOrigin(manifest.id);
    const targetDir = join(this.pluginsDirectory, manifest.id);
    rmSync(targetDir, { recursive: true, force: true });
    mkdirSync(targetDir, { recursive: true });

    const entries: Array<{ relativePath: string; file: JSZip.JSZipObject }> = [];
    zip.forEach((relativePath, file) => {
      entries.push({ relativePath, file });
    });

    try {
      const resolvedEntries = entries.map(({ relativePath, file }) => ({
        absolutePath: this.#assertSafeInstallEntryPath(targetDir, relativePath),
        file
      }));

      const writes: Promise<void>[] = [];
      for (const { absolutePath, file } of resolvedEntries) {
        if (file.dir) {
          mkdirSync(absolutePath, { recursive: true });
          continue;
        }
        writes.push(
          file.async('uint8array').then((bytes) => {
            mkdirSync(dirname(absolutePath), { recursive: true });
            writeFileSync(absolutePath, bytes);
          })
        );
      }
      await Promise.all(writes);

      const info = this.#loadFromDirectory(targetDir, 'installed');
      setPluginEnabled(info.id, false);
      this.#records.set(info.id, { info: { ...info, enabled: false }, watchers: [] });
      this.#emitChanged(info.id);
      return this.get(info.id)!;
    } catch (error) {
      rmSync(targetDir, { recursive: true, force: true });
      throw error;
    }
  }

  /**
   * Installs a plugin by cloning a public git repository.
   *
   * @param url - Public https (or http) repository URL.
   * @param ref - Optional branch or tag to clone.
   * @returns Installed plugin metadata.
   */
  async installFromGit(url: string, ref?: string): Promise<PluginInfo> {
    const normalizedUrl = assertSafeGitPluginUrl(url);
    const trimmedRef = ref?.trim() || undefined;
    mkdirSync(this.pluginsDirectory, { recursive: true });
    const tempDir = join(this.pluginsDirectory, `.tmp-clone-${randomUUID()}`);

    try {
      await git.clone({
        fs,
        http,
        dir: tempDir,
        url: normalizedUrl,
        ref: trimmedRef,
        singleBranch: true,
        depth: 1
      });

      const preview = this.#loadFromDirectory(tempDir, 'installed');
      const pluginId = preview.id;
      removeUnpackedPluginPath(pluginId);
      const targetDir = join(this.pluginsDirectory, pluginId);
      rmSync(targetDir, { recursive: true, force: true });
      renameSync(tempDir, targetDir);

      setGitPluginOrigin(pluginId, { url: normalizedUrl, ref: trimmedRef });
      setPluginEnabled(pluginId, false);

      const info: PluginInfo = {
        ...this.#loadFromDirectory(targetDir, 'git'),
        enabled: false,
        repoUrl: normalizedUrl,
        repoRef: trimmedRef
      };
      this.#records.set(pluginId, { info, watchers: [] });
      this.#emitChanged(pluginId);
      return info;
    } catch (error) {
      rmSync(tempDir, { recursive: true, force: true });
      throw error;
    }
  }

  /**
   * Re-clones a git-installed plugin from its stored origin.
   *
   * @param pluginId - Plugin manifest id.
   * @returns Updated plugin metadata.
   */
  async updateFromGit(pluginId: string): Promise<PluginInfo> {
    const origin = getGitPluginOrigins()[pluginId];
    if (!origin) {
      throw new Error(`Plugin ${pluginId} was not installed from git.`);
    }

    const record = this.#records.get(pluginId);
    if (!record) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }

    const normalizedUrl = assertSafeGitPluginUrl(origin.url);
    const trimmedRef = origin.ref;
    const tempDir = join(this.pluginsDirectory, `.tmp-clone-${randomUUID()}`);
    const targetDir = join(this.pluginsDirectory, pluginId);

    try {
      await git.clone({
        fs,
        http,
        dir: tempDir,
        url: normalizedUrl,
        ref: trimmedRef,
        singleBranch: true,
        depth: 1
      });

      const preview = this.#loadFromDirectory(tempDir, 'git');
      if (preview.id !== pluginId) {
        throw new Error(
          `Updated repository manifest id "${preview.id}" does not match installed plugin "${pluginId}".`
        );
      }

      this.#stopWatcher(pluginId);
      rmSync(targetDir, { recursive: true, force: true });
      renameSync(tempDir, targetDir);

      const info: PluginInfo = {
        ...this.#loadFromDirectory(targetDir, 'git'),
        enabled: record.info.enabled,
        repoUrl: normalizedUrl,
        repoRef: trimmedRef
      };
      this.#records.set(pluginId, { info, watchers: [] });
      this.#emitChanged(pluginId);
      return info;
    } catch (error) {
      rmSync(tempDir, { recursive: true, force: true });
      throw error;
    }
  }

  /**
   * Registers an unpacked plugin directory for development.
   *
   * @param directory - Absolute path containing manifest.json.
   * @returns Loaded plugin metadata.
   */
  loadUnpacked(directory: string): PluginInfo {
    const absolute = resolve(directory);
    const info = this.#loadFromDirectory(absolute, 'unpacked');
    setUnpackedPluginPath(info.id, absolute);
    setPluginEnabled(info.id, false);
    this.#stopWatcher(info.id);
    this.#records.set(info.id, { info: { ...info, enabled: false }, watchers: [] });
    this.#emitChanged(info.id);
    return this.get(info.id)!;
  }

  /**
   * Reloads one plugin from disk and notifies listeners.
   *
   * @param pluginId - Plugin manifest id.
   */
  reload(pluginId: string): PluginInfo {
    const existing = this.#records.get(pluginId);
    if (!existing) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }

    const directory = existing.info.path;
    const source = existing.info.source;
    const enabled = existing.info.enabled;
    this.#stopWatcher(pluginId);

    const info = this.#loadFromDirectory(directory, source);
    this.#records.set(pluginId, {
      info: { ...info, enabled },
      watchers: []
    });
    if (source === 'unpacked' && enabled) {
      this.#startWatcher(pluginId);
    }
    this.#emitChanged(pluginId);
    return this.get(pluginId)!;
  }

  /**
   * Enables or disables a plugin.
   *
   * @param pluginId - Plugin manifest id.
   * @param enabled - Whether the plugin should activate.
   */
  setEnabled(pluginId: string, enabled: boolean): PluginInfo {
    const record = this.#records.get(pluginId);
    if (!record) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }
    setPluginEnabled(pluginId, enabled);
    record.info = { ...record.info, enabled };
    if (record.info.source === 'unpacked') {
      if (enabled) {
        this.#startWatcher(pluginId);
      } else {
        this.#stopWatcher(pluginId);
      }
    }
    this.#emitChanged(pluginId);
    return record.info;
  }

  /**
   * Records or clears a plugin activation/runtime hook failure.
   *
   * @param pluginId - Plugin manifest id.
   * @param message - Error message, or null to clear a prior runtime error.
   * @returns Updated plugin metadata.
   */
  setRuntimeError(pluginId: string, message: string | null): PluginInfo {
    const record = this.#records.get(pluginId);
    if (!record) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }
    const previousError = record.info.runtimeError;
    const nextError = message ?? undefined;
    if (previousError === nextError) {
      return record.info;
    }
    const next = { ...record.info };
    if (message) {
      next.runtimeError = message;
    } else {
      delete next.runtimeError;
    }
    record.info = next;
    this.#emitChanged(pluginId);
    return record.info;
  }

  /**
   * Clears the runtime error for one plugin.
   *
   * @param pluginId - Plugin manifest id.
   * @returns Updated plugin metadata.
   */
  clearRuntimeError(pluginId: string): PluginInfo {
    return this.setRuntimeError(pluginId, null);
  }

  /**
   * Removes an installed plugin directory and registry state.
   *
   * @param pluginId - Plugin manifest id.
   */
  uninstall(pluginId: string): void {
    const record = this.#records.get(pluginId);
    if (!record) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }
    if (record.info.source !== 'installed' && record.info.source !== 'git') {
      throw new Error('Only installed plugins can be uninstalled.');
    }
    this.#stopWatcher(pluginId);
    this.#fsAllowlist.clearPlugin(pluginId);
    rmSync(record.info.path, { recursive: true, force: true });
    if (record.info.source === 'git') {
      removeGitPluginOrigin(pluginId);
    }
    clearPluginEnabled(pluginId);
    this.#records.delete(pluginId);
    this.#emitChanged(pluginId);
  }

  /**
   * Removes an unpacked dev registration without deleting source files.
   *
   * @param pluginId - Plugin manifest id.
   */
  removeUnpacked(pluginId: string): void {
    const record = this.#records.get(pluginId);
    if (!record) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }
    if (record.info.source !== 'unpacked') {
      throw new Error('Only unpacked plugins can be removed from the dev registry.');
    }
    this.#stopWatcher(pluginId);
    this.#fsAllowlist.clearPlugin(pluginId);
    removeUnpackedPluginPath(pluginId);
    clearPluginEnabled(pluginId);
    this.#records.delete(pluginId);
    this.#emitChanged(pluginId);
  }

  /**
   * Reads a plugin entry bundle as UTF-8 source text.
   *
   * @param pluginId - Plugin manifest id.
   * @param kind - Renderer or main entry.
   */
  readEntrySource(pluginId: string, kind: PluginEntryKind): string {
    const record = this.#records.get(pluginId);
    if (!record) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }
    const relativePath =
      kind === 'renderer' ? record.info.manifest.renderer : record.info.manifest.main;
    if (!relativePath) {
      throw new Error(`Plugin ${pluginId} does not declare a ${kind} entry.`);
    }
    const absolutePath = this.#resolvePluginPath(record.info.path, relativePath);
    return readFileSync(absolutePath, 'utf8');
  }

  /**
   * Resolves trusted main-entry source and permissions for SES activation.
   *
   * Main-process IPC uses this instead of trusting renderer-supplied activation
   * payloads so only enabled plugins run manifest-declared main code with declared
   * permissions.
   *
   * @param pluginId - Plugin manifest id.
   * @returns Main entry source text and granted permissions from disk state.
   */
  resolveMainActivation(pluginId: string): {
    source: string;
    permissions: PluginPermission[];
  } {
    const record = this.#records.get(pluginId);
    if (!record) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }
    if (!record.info.enabled) {
      throw new Error(`Plugin ${pluginId} is not enabled.`);
    }
    return {
      source: this.readEntrySource(pluginId, 'main'),
      permissions: this.getPluginPermissions(pluginId)
    };
  }

  /**
   * Reads a plugin asset relative to the plugin root.
   *
   * @param pluginId - Plugin manifest id.
   * @param assetPath - Plugin-relative file path.
   */
  readAsset(pluginId: string, assetPath: string): PluginAssetResult {
    const record = this.#records.get(pluginId);
    if (!record) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }
    const absolutePath = this.#resolvePluginPath(record.info.path, assetPath);
    const content = readFileSync(absolutePath);
    return {
      content: content.toString('base64'),
      mimeType: mimeTypeForPath(assetPath)
    };
  }

  /**
   * Returns a plugin-scoped persisted value.
   *
   * @param pluginId - Plugin manifest id.
   * @param key - Storage key within the plugin namespace.
   * @throws When the stored value is present but not valid JSON.
   */
  getStorageValue(pluginId: string, key: string): unknown {
    this.#assertPluginExists(pluginId);
    const raw = getLocalDatabase().getPluginValue(pluginId, key);
    if (raw == null) {
      return undefined;
    }
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      throw new Error(`Plugin ${pluginId} storage key "${key}" contains invalid JSON.`);
    }
  }

  /**
   * Persists a plugin-scoped JSON-serializable value.
   *
   * @param pluginId - Plugin manifest id.
   * @param key - Storage key within the plugin namespace.
   * @param value - Value to store.
   */
  setStorageValue(pluginId: string, key: string, value: unknown): void {
    this.#assertPluginExists(pluginId);
    getLocalDatabase().setPluginValue(pluginId, key, JSON.stringify(value));
  }

  /**
   * Stops file watchers during shutdown.
   */
  dispose(): void {
    this.disposeWatchers();
    this.#records.clear();
  }

  /**
   * Stops all file watchers without clearing plugin records.
   */
  disposeWatchers(): void {
    for (const pluginId of [...this.#records.keys()]) {
      this.#stopWatcher(pluginId);
    }
  }

  /**
   * Loads manifest.json from a plugin directory.
   *
   * @param directory - Absolute plugin root path.
   * @param source - Installed or unpacked source kind.
   */
  #loadFromDirectory(directory: string, source: PluginSource): PluginInfo {
    const manifestPath = join(directory, MANIFEST_FILENAME);
    if (!existsSync(manifestPath)) {
      throw new Error(`Plugin directory is missing ${MANIFEST_FILENAME}: ${directory}`);
    }
    let manifestRaw: unknown;
    try {
      manifestRaw = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
      throw new Error(`Plugin manifest is not valid JSON: ${manifestPath}`);
    }
    const manifest = validatePluginManifest(manifestRaw, this.#appVersion);
    this.#fsAllowlist.seedPluginDirectory(manifest.id, directory);
    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      source,
      path: directory,
      enabled: true,
      permissions: manifest.permissions,
      manifest
    };
  }

  /**
   * Builds a placeholder plugin info row when discovery fails.
   *
   * @param pluginId - Plugin id or directory name.
   * @param directory - Plugin root path.
   * @param source - Installed or unpacked source kind.
   * @param error - Discovery failure.
   */
  #brokenPluginInfo(
    pluginId: string,
    directory: string,
    source: PluginSource,
    error: unknown
  ): PluginInfo {
    return {
      id: pluginId,
      name: pluginId,
      version: '0.0.0',
      source,
      path: directory,
      enabled: false,
      permissions: [],
      manifest: {
        id: pluginId,
        name: pluginId,
        version: '0.0.0',
        engines: { harborclient: '>=0.0.0' },
        permissions: ['ui']
      },
      error: error instanceof Error ? error.message : String(error)
    };
  }

  /**
   * Scans installed plugin directories under userData/plugins.
   */
  #scanInstalled(): PluginInfo[] {
    const root = this.pluginsDirectory;
    if (!existsSync(root)) {
      mkdirSync(root, { recursive: true });
      return [];
    }

    const results: PluginInfo[] = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const directory = join(root, entry.name);
      try {
        results.push(this.#loadFromDirectory(directory, 'installed'));
      } catch (error) {
        results.push(this.#brokenPluginInfo(entry.name, directory, 'installed', error));
      }
    }
    return results;
  }

  /**
   * Resolves a path relative to a root directory and rejects traversal outside it.
   *
   * @param rootDir - Absolute directory that must contain the resolved path.
   * @param relativePath - Path relative to the root directory.
   * @returns Absolute resolved path within rootDir.
   */
  #resolvePathWithinRoot(rootDir: string, relativePath: string): string {
    const normalizedRoot = resolve(rootDir);
    const absolutePath = resolve(normalizedRoot, relativePath);
    const rel = relative(normalizedRoot, absolutePath);
    if (rel.startsWith('..') || rel.includes(`..${normalize('/')}`)) {
      throw new Error(`Plugin asset path escapes plugin directory: ${relativePath}`);
    }
    return absolutePath;
  }

  /**
   * Validates a zip entry path and returns its safe absolute install destination.
   *
   * @param targetDir - Absolute plugin install directory.
   * @param relativePath - Zip entry path relative to the archive root.
   * @returns Absolute path where the entry may be written.
   */
  #assertSafeInstallEntryPath(targetDir: string, relativePath: string): string {
    if (!relativePath || relativePath.startsWith('/') || relativePath.includes('\\')) {
      throw new Error(`Plugin archive contains an unsafe path: ${relativePath}`);
    }
    if (/^[A-Za-z]:[/\\]/.test(relativePath)) {
      throw new Error(`Plugin archive contains an unsafe path: ${relativePath}`);
    }

    const normalized = posix.normalize(relativePath.replace(/\\/g, '/'));
    if (normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
      throw new Error(`Plugin archive contains an unsafe path: ${relativePath}`);
    }
    if (normalized.split('/').some((segment) => segment === '..')) {
      throw new Error(`Plugin archive contains an unsafe path: ${relativePath}`);
    }

    return this.#resolvePathWithinRoot(targetDir, relativePath);
  }

  /**
   * Resolves a plugin-relative path and rejects path traversal.
   *
   * @param pluginRoot - Absolute plugin directory.
   * @param relativePath - Path relative to the plugin root.
   */
  #resolvePluginPath(pluginRoot: string, relativePath: string): string {
    const absolutePath = this.#resolvePathWithinRoot(pluginRoot, relativePath);
    if (!existsSync(absolutePath)) {
      throw new Error(`Plugin asset not found: ${relativePath}`);
    }
    return absolutePath;
  }

  /**
   * Ensures a plugin id exists in the in-memory registry.
   *
   * @param pluginId - Plugin manifest id.
   */
  #assertPluginExists(pluginId: string): void {
    if (!this.#records.has(pluginId)) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }
  }

  /**
   * Starts watching unpacked plugin entry files for hot reload.
   *
   * @param pluginId - Plugin manifest id.
   */
  #startWatcher(pluginId: string): void {
    const record = this.#records.get(pluginId);
    if (!record || record.info.source !== 'unpacked') {
      return;
    }
    this.#stopWatcher(pluginId);

    const { files, directories } = collectPluginHotReloadWatchTargets(
      record.info.path,
      record.info.manifest
    );
    const watched = new Set([...files, ...directories]);

    const watchers: ReturnType<typeof watch>[] = [];
    for (const filePath of watched) {
      try {
        watchers.push(
          watch(filePath, () => {
            this.#scheduleReload(pluginId);
          })
        );
      } catch {
        // Ignore watch failures for missing files during partial builds.
      }
    }

    record.watchers = watchers;
  }

  /**
   * Stops file watchers for one plugin.
   *
   * @param pluginId - Plugin manifest id.
   */
  #stopWatcher(pluginId: string): void {
    const record = this.#records.get(pluginId);
    if (!record) {
      return;
    }
    for (const watcher of record.watchers) {
      watcher.close();
    }
    record.watchers = [];
    const timer = this.#reloadTimers.get(pluginId);
    if (timer) {
      clearTimeout(timer);
      this.#reloadTimers.delete(pluginId);
    }
  }

  /**
   * Debounces hot reload notifications for one plugin.
   *
   * @param pluginId - Plugin manifest id.
   */
  #scheduleReload(pluginId: string): void {
    const existing = this.#reloadTimers.get(pluginId);
    if (existing) {
      clearTimeout(existing);
    }
    this.#reloadTimers.set(
      pluginId,
      setTimeout(() => {
        this.#reloadTimers.delete(pluginId);
        try {
          this.reload(pluginId);
        } catch (error) {
          const record = this.#records.get(pluginId);
          if (record) {
            record.info = {
              ...record.info,
              error: error instanceof Error ? error.message : String(error)
            };
          }
          this.#emitChanged(pluginId);
        }
      }, RELOAD_DEBOUNCE_MS)
    );
  }

  /**
   * Notifies the renderer that a plugin changed.
   *
   * @param pluginId - Plugin manifest id.
   */
  #emitChanged(pluginId: string): void {
    const window = this.#notifyWindow?.() ?? null;
    if (window && !window.isDestroyed()) {
      window.webContents.send('plugins:changed', pluginId);
    }
  }
}

/**
 * Returns a MIME type guess for plugin asset paths.
 *
 * @param filePath - Plugin-relative asset path.
 */
function mimeTypeForPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.js')) return 'text/javascript';
  return 'application/octet-stream';
}
