import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Packages that must remain external in the CLI esbuild bundle.
 *
 * These are shipped beside `resources/cli/index.js` as `cli/node_modules`.
 */
const ALLOWED_EXTERNAL_PACKAGES = new Set(['better-sqlite3', 'esbuild']);

/**
 * Node built-in module names that may appear as bare `from "..."` imports.
 */
const NODE_BUILTINS = new Set([
  'assert',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'fs/promises',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'timers',
  'tls',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib'
]);

/**
 * Extracts bare package names from ESM import statements in the CLI bundle.
 *
 * @param source - Bundled CLI JavaScript source.
 * @returns Sorted unique bare import specifiers (package names, not paths).
 */
function extractBareImportPackages(source: string): string[] {
  const packages = new Set<string>();
  const importRe = /(?:^|\n)\s*import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(source)) !== null) {
    const specifier = match[1]!;
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      continue;
    }
    if (specifier.startsWith('node:')) {
      continue;
    }
    const bare = specifier.startsWith('@')
      ? specifier.split('/').slice(0, 2).join('/')
      : specifier.split('/')[0]!;
    packages.add(bare);
  }
  return [...packages].sort();
}

/**
 * Returns whether a bare import is an allowed Node builtin (legacy or node: form).
 *
 * @param packageName - Bare package name from an import specifier.
 * @returns True when the name is a known Node.js builtin.
 */
function isNodeBuiltin(packageName: string): boolean {
  return NODE_BUILTINS.has(packageName);
}

describe('CLI bundle externals', () => {
  it('only externalizes better-sqlite3 and esbuild (plus Node builtins)', () => {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
    const bundlePath = join(repoRoot, 'apps', 'cli', 'dist', 'index.js');
    expect(
      existsSync(bundlePath),
      `CLI bundle missing at ${bundlePath}; build @harborclient/cli first`
    ).toBe(true);

    const source = readFileSync(bundlePath, 'utf8');
    const barePackages = extractBareImportPackages(source);
    const unexpected = barePackages.filter(
      (name) => !ALLOWED_EXTERNAL_PACKAGES.has(name) && !isNodeBuiltin(name)
    );

    expect(unexpected).toEqual([]);
    expect(barePackages).toEqual(expect.arrayContaining([...ALLOWED_EXTERNAL_PACKAGES]));
  });
});
