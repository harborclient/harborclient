import fs from 'node:fs';
import path from 'node:path';
import type { LiveServerAlias } from '@harborclient/core/types';
import { resolveAliasTarget } from './liveServerApp.js';

/** Debounce window before a file-change callback fires. */
export const LIVE_SERVER_WATCH_DEBOUNCE_MS = 120;

/**
 * Handle returned by {@link startLiveServerWatcher}.
 */
export interface LiveServerWatcherHandle {
  /**
   * Stops all watchers and clears pending debounce timers.
   */
  stop: () => void;

  /**
   * True when at least one directory watcher was successfully started.
   */
  watching: boolean;
}

/**
 * Collects unique absolute directories to watch for a live server.
 *
 * @param root - Document root.
 * @param aliases - Path aliases whose targets should also be watched.
 * @returns Deduplicated absolute directory paths that exist.
 */
export function collectWatchDirectories(root: string, aliases: LiveServerAlias[]): string[] {
  const dirs = new Set<string>();
  const resolvedRoot = path.resolve(root);
  if (fs.existsSync(resolvedRoot) && fs.statSync(resolvedRoot).isDirectory()) {
    dirs.add(resolvedRoot);
  }
  for (const alias of aliases) {
    const target = resolveAliasTarget(resolvedRoot, alias.target);
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
      dirs.add(target);
    }
  }
  return [...dirs];
}

/**
 * Starts recursive `fs.watch` listeners for a live server's root and alias targets.
 *
 * Changes are debounced by {@link LIVE_SERVER_WATCH_DEBOUNCE_MS}. Watcher errors
 * such as `ENOSPC` / `EPERM` are swallowed so a failed watch does not stop the
 * HTTP server; `watching` will be false when no watcher could be started.
 *
 * @param root - Document root directory.
 * @param aliases - Path aliases to include in the watch set.
 * @param onChange - Callback invoked after a debounced change.
 * @returns Handle used to stop watching.
 */
export function startLiveServerWatcher(
  root: string,
  aliases: LiveServerAlias[],
  onChange: () => void
): LiveServerWatcherHandle {
  const directories = collectWatchDirectories(root, aliases);
  const watchers: fs.FSWatcher[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  /**
   * Schedules a debounced change notification.
   */
  function scheduleChange(): void {
    if (stopped) {
      return;
    }
    if (timer != null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      if (!stopped) {
        onChange();
      }
    }, LIVE_SERVER_WATCH_DEBOUNCE_MS);
  }

  for (const dir of directories) {
    try {
      const watcher = fs.watch(dir, { recursive: true }, () => {
        scheduleChange();
      });
      watcher.on('error', () => {
        // Ignore ENOSPC/EPERM/etc.; the HTTP server continues without reload.
      });
      watchers.push(watcher);
    } catch {
      // Directory may be unreadable; continue with remaining paths.
    }
  }

  return {
    watching: watchers.length > 0,
    stop: () => {
      stopped = true;
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
      for (const watcher of watchers) {
        try {
          watcher.close();
        } catch {
          // Ignore close errors during shutdown.
        }
      }
      watchers.length = 0;
    }
  };
}
