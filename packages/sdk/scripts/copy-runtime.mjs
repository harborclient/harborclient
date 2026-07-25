#!/usr/bin/env node
import { cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const skipTestFiles = (src) => !/\.test\.(ts|tsx)$/.test(src);

cpSync(join(root, 'src/runtime'), join(root, 'dist/runtime'), {
  recursive: true,
  filter: skipTestFiles
});
cpSync(join(root, 'src/runtime/view-host'), join(root, 'dist/runtime/view-host'), {
  recursive: true,
  filter: skipTestFiles
});
cpSync(join(root, 'src/client.d.ts'), join(root, 'dist/client.d.ts'));
cpSync(join(root, 'src/snippets.d.ts'), join(root, 'dist/snippets.d.ts'));
cpSync(join(root, 'src/styles.css'), join(root, 'dist/styles.css'));
cpSync(join(root, 'src/styles.css.d.ts'), join(root, 'dist/styles.css.d.ts'));
