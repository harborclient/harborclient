import { watch, type FSWatcher } from 'fs';
import type { BrowserWindow } from 'electron';
import { normalizePath } from './pluginFsAllowlist';
import type { PluginFsAllowlist } from './pluginFsAllowlist';

const DEBOUNCE_MS = 300;

interface WatchRecord {
  watcher: FSWatcher;
  refCount: number;
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Watches allowlisted plugin filesystem paths and notifies renderer windows.
 */
export class PluginFsWatcher {
  readonly #allowlist: PluginFsAllowlist;
  readonly #records = new Map<string, WatchRecord>();
  #windowProvider: () => BrowserWindow | null = () => null;
  #pluginWebviewNotifier: ((pluginId: string, normalizedPath: string) => void) | null = null;

  /**
   * @param allowlist - Plugin filesystem allowlist used to validate watch targets.
   */
  constructor(allowlist: PluginFsAllowlist) {
    this.#allowlist = allowlist;
  }

  /**
   * Sets the callback used to resolve the active browser window for IPC events.
   *
   * @param provider - Returns the window whose webContents receive fs change events.
   */
  setWindowProvider(provider: () => BrowserWindow | null): void {
    this.#windowProvider = provider;
  }

  /**
   * Registers a callback used to notify plugin webviews about watched file changes.
   *
   * @param notifier - Receives the plugin id and normalized path that changed.
   */
  setPluginWebviewNotifier(notifier: (pluginId: string, normalizedPath: string) => void): void {
    this.#pluginWebviewNotifier = notifier;
  }

  /**
   * Starts watching one allowlisted file path for a plugin.
   *
   * @param pluginId - Plugin manifest id.
   * @param targetPath - Absolute file path on the plugin allowlist.
   */
  watchFile(pluginId: string, targetPath: string): void {
    this.#allowlist.assertAllowed(pluginId, targetPath);
    const normalized = normalizePath(targetPath);
    const key = this.#watchKey(pluginId, normalized);
    const existing = this.#records.get(key);
    if (existing) {
      existing.refCount += 1;
      return;
    }

    const watcher = watch(normalized, () => {
      this.#scheduleNotify(pluginId, normalized, key);
    });
    watcher.on('error', () => {
      this.#unwatchKey(key);
    });
    this.#records.set(key, { watcher, refCount: 1, debounceTimer: null });
  }

  /**
   * Stops watching one file path for a plugin when the last subscriber disposes.
   *
   * @param pluginId - Plugin manifest id.
   * @param targetPath - Absolute file path previously watched.
   */
  unwatchFile(pluginId: string, targetPath: string): void {
    const normalized = normalizePath(targetPath);
    const key = this.#watchKey(pluginId, normalized);
    const record = this.#records.get(key);
    if (!record) {
      return;
    }
    record.refCount -= 1;
    if (record.refCount <= 0) {
      this.#unwatchKey(key);
    }
  }

  /**
   * Stops all filesystem watchers registered for one plugin.
   *
   * @param pluginId - Plugin manifest id.
   */
  clearPlugin(pluginId: string): void {
    const prefix = `${pluginId}:`;
    for (const key of [...this.#records.keys()]) {
      if (key.startsWith(prefix)) {
        this.#unwatchKey(key);
      }
    }
  }

  /**
   * Builds the internal watch map key for one plugin path pair.
   *
   * @param pluginId - Plugin manifest id.
   * @param normalizedPath - Normalized absolute path.
   */
  #watchKey(pluginId: string, normalizedPath: string): string {
    return `${pluginId}:${normalizedPath}`;
  }

  /**
   * Debounces filesystem change notifications for one watch target.
   *
   * @param pluginId - Plugin manifest id.
   * @param normalizedPath - Normalized absolute path that changed.
   * @param key - Internal watch map key.
   */
  #scheduleNotify(pluginId: string, normalizedPath: string, key: string): void {
    const record = this.#records.get(key);
    if (!record) {
      return;
    }
    if (record.debounceTimer) {
      clearTimeout(record.debounceTimer);
    }
    record.debounceTimer = setTimeout(() => {
      record.debounceTimer = null;
      this.#emitChanged(pluginId, normalizedPath);
    }, DEBOUNCE_MS);
  }

  /**
   * Sends a filesystem change event to the active renderer window.
   *
   * @param pluginId - Plugin manifest id.
   * @param normalizedPath - Normalized absolute path that changed.
   */
  #emitChanged(pluginId: string, normalizedPath: string): void {
    const window = this.#windowProvider();
    window?.webContents.send('plugins:fsChanged', { pluginId, path: normalizedPath });
    this.#pluginWebviewNotifier?.(pluginId, normalizedPath);
  }

  /**
   * Closes one watch record and removes it from the internal map.
   *
   * @param key - Internal watch map key.
   */
  #unwatchKey(key: string): void {
    const record = this.#records.get(key);
    if (!record) {
      return;
    }
    if (record.debounceTimer) {
      clearTimeout(record.debounceTimer);
    }
    record.watcher.close();
    this.#records.delete(key);
  }
}
