import { watch } from 'fs';
import type { BrowserWindow } from 'electron';
import type { RoutingStorage } from '#/main/storage/RoutingStorage';
import { resolveHarborclientRoot } from './fileLayout';
import { listStorageConnections } from '#/main/settings/storageSettings';
import type { StorageConnection } from '#/shared/types/storage';

const DEBOUNCE_MS = 500;

/**
 * Connection ids that already have a file watcher registered.
 */
const watchedConnectionIds = new Set<string>();

/**
 * Callback invoked when a watched git working tree changes on disk.
 */
export type GitWorkingTreeChangedNotifier = (connectionId: string) => void;

/**
 * Starts a file watcher for one git-backed HarborClient directory when it is not
 * already watched, reloads from disk on change, reconciles the registry, and
 * notifies the renderer.
 *
 * @param router - Routing database with mounted git backends.
 * @param connection - Git storage connection to watch.
 * @param notifyWorkingTreeChanged - Notifies the renderer that the tree changed.
 */
export function watchGitConnection(
  router: RoutingStorage,
  connection: StorageConnection & { type: 'git' },
  notifyWorkingTreeChanged: GitWorkingTreeChangedNotifier
): void {
  if (watchedConnectionIds.has(connection.id)) {
    return;
  }

  if (!router.isConnectionMounted(connection.id)) {
    return;
  }

  const watchRoot = resolveHarborclientRoot(
    connection.settings.repoPath,
    connection.settings.subdir
  );

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  try {
    watch(watchRoot, { recursive: true }, () => {
      if (debounceTimer != null) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        void (async () => {
          try {
            const gitDb = router.requireGitStorage(connection.id);
            await gitDb.reloadFromDisk();
            await router.reconcileGitRegistry(connection.id);
          } catch (err) {
            console.warn(`Failed to reload git collections for "${connection.name}":`, err);
          }

          notifyWorkingTreeChanged(connection.id);
        })();
      }, DEBOUNCE_MS);
    });
    watchedConnectionIds.add(connection.id);
  } catch (err) {
    console.warn(`Failed to watch git directory for "${connection.name}":`, err);
  }
}

/**
 * Starts file watchers for git-backed HarborClient directories, reloads from disk,
 * reconciles the registry, and notifies the renderer.
 *
 * @param router - Routing database with mounted git backends.
 * @param getMainWindow - Returns the focused main window for IPC events.
 */
export function startGitWatchers(
  router: RoutingStorage,
  getMainWindow: () => BrowserWindow | null
): void {
  const connections = listStorageConnections().filter((conn) => conn.type === 'git');

  for (const connection of connections) {
    if (connection.type !== 'git') {
      continue;
    }

    watchGitConnection(router, connection, (connectionId) => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('git:workingTreeChanged', connectionId);
      }
    });
  }
}

/**
 * Clears the in-memory watcher registry. Intended for tests only.
 */
export function resetGitWatcherRegistryForTests(): void {
  watchedConnectionIds.clear();
}
