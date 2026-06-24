import { watch } from 'fs';
import type { BrowserWindow } from 'electron';
import type { RoutingStorage } from '#/main/storage/RoutingStorage';
import { resolveHarborclientRoot } from '#/main/git/fileLayout';
import { listStorageConnections } from '#/main/settings/storageSettings';

const DEBOUNCE_MS = 500;

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
    if (!router.isConnectionMounted(connection.id)) {
      continue;
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

            const win = getMainWindow();
            if (win && !win.isDestroyed()) {
              win.webContents.send('git:workingTreeChanged', connection.id);
            }
          })();
        }, DEBOUNCE_MS);
      });
    } catch (err) {
      console.warn(`Failed to watch git directory for "${connection.name}":`, err);
    }
  }
}
