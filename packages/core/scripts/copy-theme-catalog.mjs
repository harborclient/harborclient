/**
 * Copies generated theme catalog JSON into `dist/` after `tsc` emit.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const coreRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(coreRoot, 'src/theme/hc_theme.json');
const destDir = path.join(coreRoot, 'dist/theme');
const dest = path.join(destDir, 'hc_theme.json');

mkdirSync(destDir, { recursive: true });
copyFileSync(source, dest);
