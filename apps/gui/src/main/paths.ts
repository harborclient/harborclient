import { join } from 'node:path';

/**
 * Returns the compiled main-process output directory (`out/main`).
 *
 * Vite may emit GUI main modules under `out/main/chunks/`. Those modules must
 * not use their local `__dirname` when resolving sibling build artifacts such
 * as preload scripts, renderer HTML, or runner entrypoints.
 *
 * @returns Absolute path to the main-process bundle root.
 */
export function resolveMainOutDir(): string {
  const dir = __dirname;
  if (dir.endsWith('/chunks') || dir.endsWith('\\chunks')) {
    return join(dir, '..');
  }
  return dir;
}

/**
 * Resolves a path relative to the main-process build output root.
 *
 * @param segments - Path segments appended after the bundle root.
 * @returns Absolute path under or beside `out/main`.
 */
export function resolveFromMainOut(...segments: string[]): string {
  return join(resolveMainOutDir(), ...segments);
}
