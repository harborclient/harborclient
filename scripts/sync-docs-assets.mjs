import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(scriptDir, '..');
const staticImagesDir = path.join(repoDir, 'docs/.vitepress/static/images');

/** Repo-relative sources copied into the VitePress static dir on each docs build. */
const assets = [
  ['images/logo.png', 'logo.png'],
  ['images/screenshots/request-response.png', 'screenshots/request-response.png'],
  ['images/screenshots/settings-general.png', 'screenshots/settings-general.png'],
  ['images/screenshots/settings-shortcuts.png', 'screenshots/settings-shortcuts.png'],
  ['images/screenshots/settings-proxy.png', 'screenshots/settings-proxy.png'],
  ['images/screenshots/settings-databases.png', 'screenshots/settings-databases.png'],
  ['images/screenshots/settings-ai.png', 'screenshots/settings-ai.png'],
  ['images/screenshots/ai-sidebar.png', 'screenshots/ai-sidebar.png'],
  ['images/screenshots/team-hubs.png', 'screenshots/team-hubs.png'],
  ['images/screenshots/team-hubs-users.png', 'screenshots/team-hubs-users.png'],
  ['images/screenshots/sharing-keys.png', 'screenshots/sharing-keys.png'],
  ['images/screenshots/post-request-script.png', 'screenshots/post-request-script.png'],
  ['images/screenshots/edit-database.png', 'screenshots/edit-database.png'],
  ['images/screenshots/sidebar.png', 'screenshots/sidebar.png'],
  ['build/icons/16x16.png', 'favicon-16x16.png'],
  ['build/icons/32x32.png', 'favicon-32x32.png'],
  ['build/icons/128x128.png', 'apple-touch-icon.png'],
];

await mkdir(staticImagesDir, { recursive: true });

/** Markdown image paths (e.g. `images/screenshots/ai-sidebar.png`) resolve from `docs/`. */
const docsImagesDir = path.join(repoDir, 'docs/images');

for (const [source, target] of assets) {
  const staticDestination = path.join(staticImagesDir, target);
  await mkdir(path.dirname(staticDestination), { recursive: true });
  await copyFile(path.join(repoDir, source), staticDestination);

  if (source.startsWith('images/')) {
    const docsDestination = path.join(docsImagesDir, source.slice('images/'.length));
    await mkdir(path.dirname(docsDestination), { recursive: true });
    await copyFile(path.join(repoDir, source), docsDestination);
  }
}

console.log(`Synced ${assets.length} asset(s) into docs/.vitepress/static/images/`);
