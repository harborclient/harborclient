#!/usr/bin/env node
/**
 * Watches SDK runtime shims and static assets, re-running copy-runtime on change.
 *
 * `tsc --watch` only emits TypeScript outputs. Hand-written files under
 * `src/runtime/`, plus `client.d.ts`, `snippets.d.ts`, and `styles.css`, are
 * copied into `dist/` by `copy-runtime.mjs`. This watcher keeps those copies
 * fresh during `pnpm dev` without introducing a file-watcher dependency.
 */
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const copyScript = join(root, 'scripts/copy-runtime.mjs');
const debounceMs = 150;

/** @type {ReturnType<typeof setTimeout> | undefined} */
let pending;

/**
 * Runs `copy-runtime.mjs` and logs success or failure.
 *
 * @returns {void}
 */
function runCopy() {
  const child = spawn(process.execPath, [copyScript], {
    cwd: root,
    stdio: 'inherit'
  });

  child.on('exit', (code) => {
    if (code === 0) {
      console.log('[watch-runtime] copied runtime assets to dist/');
    } else {
      console.error(`[watch-runtime] copy-runtime exited with code ${code}`);
    }
  });
}

/**
 * Schedules a debounced copy so rapid filesystem events collapse into one run.
 *
 * @returns {void}
 */
function scheduleCopy() {
  if (pending !== undefined) {
    clearTimeout(pending);
  }

  pending = setTimeout(() => {
    pending = undefined;
    runCopy();
  }, debounceMs);
}

const watchTargets = [
  join(root, 'src/runtime'),
  join(root, 'src/client.d.ts'),
  join(root, 'src/snippets.d.ts'),
  join(root, 'src/styles.css'),
  join(root, 'src/styles.css.d.ts')
];

for (const target of watchTargets) {
  watch(target, { recursive: true }, scheduleCopy);
}

console.log('[watch-runtime] watching runtime assets');
runCopy();
