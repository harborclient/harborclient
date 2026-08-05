import { app } from 'electron';
import { existsSync, statSync } from 'fs';
import { extname, sep } from 'path';
import type { GitSettings } from '@harborclient/core/types';
import { resolveRealPath } from '#/main/plugins/pluginFsAllowlist';
import { getGeneralSettings } from '#/main/settings/generalSettings';
import { listStorageConnections } from '#/main/settings/storageSettings';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';

/**
 * Extensions that must not be launched via `shell.openPath`.
 *
 * Matching is case-insensitive against the final path extension.
 */
const EXECUTABLE_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.scr',
  '.ps1',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.wsf',
  '.wsh',
  '.msc',
  '.dll',
  '.so',
  '.dylib',
  '.sh',
  '.bash',
  '.zsh',
  '.csh',
  '.fish',
  '.run',
  '.bin',
  '.app',
  '.dmg',
  '.pkg',
  '.apk',
  '.hta',
  '.cpl',
  '.inf',
  '.reg',
  '.sct',
  '.lnk',
  '.pif'
]);

/**
 * Session (and optionally seeded) paths the user confirmed via a native dialog
 * or that the main process recorded from a trusted source such as a download.
 */
const grantedPaths = new Set<string>();

/**
 * Optional extra known-root providers (for example Team Hub live-server roots).
 */
const knownRootProviders: Array<() => string[]> = [];

/**
 * Returns whether a candidate absolute path is equal to or nested under a root.
 *
 * @param rootResolved - Absolute resolved directory or file grant.
 * @param candidateResolved - Absolute resolved candidate path.
 * @returns True when the candidate is the root or a descendant of it.
 */
export function isPathUnderGrantedRoot(rootResolved: string, candidateResolved: string): boolean {
  if (candidateResolved === rootResolved) {
    return true;
  }
  const prefix = rootResolved.endsWith(sep) ? rootResolved : `${rootResolved}${sep}`;
  return candidateResolved.startsWith(prefix);
}

/**
 * Registers a callback that contributes additional known filesystem roots.
 *
 * Used by live-server handlers to expose provider-backed document roots without
 * coupling this module to RoutingStorage.
 *
 * @param provider - Returns absolute paths that should be treated as known roots.
 */
export function registerFilePathKnownRootProvider(provider: () => string[]): void {
  knownRootProviders.push(provider);
}

/**
 * Clears session grants and known-root providers. Intended for unit tests.
 */
export function resetFilePathAccessForTests(): void {
  grantedPaths.clear();
  knownRootProviders.length = 0;
}

/**
 * Records a path as user- or main-process-confirmed for later file IPC.
 *
 * Dialog picks, Chromium download completions, and similar trusted sources
 * should call this so subsequent open/read/write checks succeed.
 *
 * @param targetPath - Absolute path to grant (file or directory).
 * @returns Canonical granted path.
 */
export function grantFilePathAccess(targetPath: string): string {
  const resolved = resolveRealPath(targetPath.trim());
  grantedPaths.add(resolved);
  return resolved;
}

/**
 * Collects always-allowed filesystem roots from app paths and user settings.
 *
 * @returns Absolute known roots (may include paths that do not exist yet).
 */
export function listFilePathAccessKnownRoots(): string[] {
  const roots: string[] = [];
  const add = (value: string | undefined): void => {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) {
      return;
    }
    try {
      roots.push(resolveRealPath(trimmed));
    } catch {
      // Ignore invalid configured paths; callers still need an explicit grant.
    }
  };

  add(app.getPath('userData'));
  add(app.getPath('downloads'));

  const general = getGeneralSettings();
  add(general.scriptFileRoot);
  add(general.workflowResultsDirectory);

  for (const connection of listStorageConnections()) {
    if (connection.type !== 'git') {
      continue;
    }
    const settings = connection.settings as GitSettings;
    add(typeof settings.repoPath === 'string' ? settings.repoPath : undefined);
  }

  try {
    for (const server of getLocalDatabase().listLiveServers()) {
      add(server.root);
    }
  } catch {
    // Local DB may be unavailable during early startup or isolated unit tests.
  }

  for (const provider of knownRootProviders) {
    for (const root of provider()) {
      add(root);
    }
  }

  return roots;
}

/**
 * Returns whether a path is under a known root or a dialog/download grant.
 *
 * @param targetPath - Absolute path to check.
 * @returns True when file IPC may touch the path.
 */
export function isFilePathAllowed(targetPath: string): boolean {
  const trimmed = targetPath.trim();
  if (!trimmed) {
    return false;
  }

  let resolved: string;
  try {
    resolved = resolveRealPath(trimmed);
  } catch {
    return false;
  }

  for (const granted of grantedPaths) {
    if (isPathUnderGrantedRoot(granted, resolved)) {
      return true;
    }
  }

  for (const root of listFilePathAccessKnownRoots()) {
    if (isPathUnderGrantedRoot(root, resolved)) {
      return true;
    }
  }

  return false;
}

/**
 * Asserts that a path is under a known root or grant and returns its realpath.
 *
 * @param targetPath - Absolute path from IPC.
 * @returns Canonical absolute path.
 * @throws When the path is empty or outside the allowlist.
 */
export function assertFilePathAllowed(targetPath: string): string {
  const trimmed = targetPath.trim();
  if (!trimmed) {
    throw new Error('Path is required');
  }
  if (!isFilePathAllowed(trimmed)) {
    throw new Error('Path is not allowed');
  }
  return resolveRealPath(trimmed);
}

/**
 * Asserts a directory may receive writes from `files:writeTextInDirectory`.
 *
 * Write destinations are limited to dialog/download grants and the configured
 * workflow results directory — not every known root (for example userData).
 *
 * @param directory - Absolute directory from IPC.
 * @returns Canonical absolute directory path.
 * @throws When the directory is empty or not writable under this policy.
 */
export function assertFilePathWritableDirectory(directory: string): string {
  const trimmed = directory.trim();
  if (!trimmed) {
    throw new Error('Directory path is required');
  }

  let resolved: string;
  try {
    resolved = resolveRealPath(trimmed);
  } catch {
    throw new Error('Path is not allowed');
  }

  for (const granted of grantedPaths) {
    if (resolved === granted || isPathUnderGrantedRoot(granted, resolved)) {
      return resolved;
    }
  }

  const workflowDirectory = getGeneralSettings().workflowResultsDirectory.trim();
  if (workflowDirectory) {
    try {
      const workflowResolved = resolveRealPath(workflowDirectory);
      if (resolved === workflowResolved || isPathUnderGrantedRoot(workflowResolved, resolved)) {
        return resolved;
      }
    } catch {
      // Invalid configured directory does not expand write access.
    }
  }

  throw new Error('Path is not allowed');
}

/**
 * Returns whether a filesystem path looks like an executable that openPath must deny.
 *
 * Directories are never treated as executables. Files match when they use a
 * blocked extension or (on POSIX) have any execute permission bit set.
 *
 * @param targetPath - Absolute path to inspect (need not exist).
 * @returns True when `shell.openPath` should refuse the path.
 */
export function isExecutableFilePath(targetPath: string): boolean {
  const resolved = resolveRealPath(targetPath.trim());
  const extension = extname(resolved).toLowerCase();
  if (EXECUTABLE_EXTENSIONS.has(extension)) {
    return true;
  }

  if (!existsSync(resolved)) {
    return false;
  }

  const stats = statSync(resolved);
  if (stats.isDirectory()) {
    return false;
  }
  if (process.platform === 'win32') {
    return false;
  }
  const executeBits = 0o111;
  return (stats.mode & executeBits) !== 0;
}

/**
 * Asserts a path may be opened with `shell.openPath` (allowlisted and non-executable).
 *
 * @param targetPath - Absolute path from IPC.
 * @returns Canonical absolute path safe to pass to `shell.openPath`.
 * @throws When the path is disallowed or looks executable.
 */
export function assertFilePathOpenable(targetPath: string): string {
  const resolved = assertFilePathAllowed(targetPath);
  if (isExecutableFilePath(resolved)) {
    throw new Error('Refusing to open executable path');
  }
  return resolved;
}
