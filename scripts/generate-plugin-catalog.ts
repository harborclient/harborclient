import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePluginCatalog } from '../src/shared/plugin/catalog.ts';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(scriptDir, '..');
const sourcePath = path.join(repoDir, 'plugins/catalog.json');
const outputPath = path.join(repoDir, 'docs/.vitepress/static/plugin_catalog.json');

const raw = JSON.parse(await readFile(sourcePath, 'utf8')) as unknown;
const catalog = parsePluginCatalog(raw);
const plugins = [...catalog.plugins].sort((left, right) =>
  left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
);

const output = {
  schemaVersion: catalog.schemaVersion,
  updatedAt: new Date().toISOString(),
  plugins
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(
  `Wrote ${path.relative(repoDir, outputPath)} with ${plugins.length} plugin listing(s)`
);
