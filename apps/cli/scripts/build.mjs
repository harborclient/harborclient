#!/usr/bin/env node
/**
 * Bundles the HarborClient CLI into a single ESM file.
 *
 * Native/binary packages stay external so packaging can ship Electron-rebuilt
 * copies beside the CLI entry (`resources/cli/node_modules`). Pure JS deps are
 * inlined so the packaged CLI does not need a full node_modules tree.
 */
import { build } from 'esbuild';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(scriptDir, '..');
const outfile = join(packageRoot, 'dist', 'index.js');

mkdirSync(dirname(outfile), { recursive: true });

await build({
  entryPoints: [join(packageRoot, 'src', 'index.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile,
  banner: {
    js: 'import { createRequire as __hcCreateRequire } from "module";\nconst require = __hcCreateRequire(import.meta.url);'
  },
  external: ['better-sqlite3', 'esbuild'],
  logLevel: 'info'
});

const bundled = readFileSync(outfile, 'utf8');
writeFileSync(outfile, `#!/usr/bin/env node\n${bundled}`);
chmodSync(outfile, 0o755);
