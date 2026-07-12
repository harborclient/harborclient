import { app } from 'electron';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { logVerbose } from '#/main/logger';

const RAND_USER_DIR_PREFIX = 'harborclient-';

let randUserDirPath: string | null = null;

/**
 * Returns true when `--rand-user-dir` was passed on the command line.
 *
 * @param argv - Process argv including Electron flags.
 * @returns True when the app should use an isolated temporary profile directory.
 */
export function isRandUserDirFlagEnabled(argv: string[] = process.argv): boolean {
  return argv.includes('--rand-user-dir');
}

/**
 * Creates a random directory under the OS temp folder and redirects Electron
 * `userData` and `sessionData` there when `--rand-user-dir` is present.
 *
 * Must run before `app.whenReady()` and before any `app.getPath('userData')`
 * call so databases, settings, and Chromium session storage all land in the
 * temporary profile.
 *
 * @param argv - Process argv including Electron flags.
 * @returns Absolute path to the temporary profile, or null when the flag is absent.
 */
export function applyRandUserDirIfRequested(argv: string[] = process.argv): string | null {
  if (!isRandUserDirFlagEnabled(argv)) {
    return null;
  }

  const dirPath = mkdtempSync(join(tmpdir(), RAND_USER_DIR_PREFIX));
  app.setPath('userData', dirPath);
  app.setPath('sessionData', dirPath);
  randUserDirPath = dirPath;
  logVerbose('[rand-user-dir] using temporary profile:', dirPath);
  return dirPath;
}

/**
 * Returns the temporary profile path created for this process, if any.
 *
 * @returns Absolute path when `--rand-user-dir` was applied; otherwise null.
 */
export function getRandUserDirForCleanup(): string | null {
  return randUserDirPath;
}

/**
 * Best-effort removal of the temporary profile directory created by
 * {@link applyRandUserDirIfRequested}.
 *
 * Only deletes the path recorded by that helper; abnormal termination may
 * leave the directory on disk.
 */
export function cleanupRandUserDir(): void {
  if (randUserDirPath == null) {
    return;
  }

  const dirPath = randUserDirPath;
  randUserDirPath = null;

  try {
    rmSync(dirPath, { recursive: true, force: true });
    logVerbose('[rand-user-dir] removed temporary profile:', dirPath);
  } catch (error) {
    logVerbose('[rand-user-dir] failed to remove temporary profile:', dirPath, error);
  }
}
