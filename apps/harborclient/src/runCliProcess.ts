/**
 * Spawns the HarborClient CLI under Electron's Node mode.
 *
 * Uses `ELECTRON_RUN_AS_NODE=1` so the same packaged binary runs the CLI
 * bundle without shipping a second Node runtime.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from 'electron';

/**
 * Returns this module's directory (source, Vitest, or electron-vite bundle).
 *
 * @returns Absolute directory containing this file.
 */
function getModuleDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}

/**
 * Resolves the packaged or development path to the CLI entry script.
 *
 * @returns Absolute path to `cli/index.js`, or null when missing.
 */
export function resolveCliScriptPath(): string | null {
  if (app.isPackaged) {
    const packagedPath = join(process.resourcesPath, 'cli', 'index.js');
    return existsSync(packagedPath) ? packagedPath : null;
  }

  const moduleDir = getModuleDir();
  // Bundled bootstrap: apps/gui/out/main → apps/cli/dist
  // Vitest source: apps/harborclient/src → apps/cli/dist
  const devCandidates = [
    join(moduleDir, '..', '..', '..', 'cli', 'dist', 'index.js'),
    join(moduleDir, '..', '..', 'cli', 'dist', 'index.js')
  ];

  for (const candidate of devCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Re-executes the current Electron binary as Node to run the CLI entry.
 *
 * @param cliArgv - User argv for the CLI (METHOD/url or `run …`).
 * @returns Child process exit code (1 when the CLI script cannot be found).
 */
export function runCliProcess(cliArgv: string[]): Promise<number> {
  const cliScriptPath = resolveCliScriptPath();
  if (!cliScriptPath) {
    console.error('HarborClient CLI bundle not found. Build @harborclient/cli first.');
    return Promise.resolve(1);
  }

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliScriptPath, ...cliArgv], {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1'
      },
      stdio: 'inherit'
    });

    child.on('error', (err) => {
      console.error(err instanceof Error ? err.message : String(err));
      resolve(1);
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        resolve(1);
        return;
      }
      resolve(code ?? 1);
    });
  });
}
