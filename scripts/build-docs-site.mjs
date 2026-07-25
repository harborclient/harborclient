#!/usr/bin/env node
/**
 * Builds the combined GitHub Pages site for core and SDK docs.
 *
 * Each package still builds with its own VitePress `base` (`/harborclient/core/`
 * and `/harborclient/sdk/`). This script stages those outputs under `_site/core`
 * and `_site/sdk` so asset URLs resolve correctly when Pages serves the repo
 * root, and writes a small landing page at `_site/index.html`.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = join(repoRoot, '_site');

/**
 * Runs a pnpm filter script and throws when the child exits non-zero.
 *
 * @param {string} filter - Workspace package name.
 * @param {string} script - Package script to run.
 * @returns {void}
 */
function runPackageScript(filter, script) {
  const result = spawnSync('pnpm', ['--filter', filter, script], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false
  });

  if (result.status !== 0) {
    throw new Error(`pnpm --filter ${filter} ${script} failed with status ${result.status}`);
  }
}

/**
 * Stages one VitePress dist directory under `_site/<subdir>`.
 *
 * @param {string} distPath - Absolute path to the VitePress dist output.
 * @param {string} subdir - Subdirectory name under `_site`.
 * @returns {void}
 */
function stageDist(distPath, subdir) {
  const target = join(siteRoot, subdir);
  mkdirSync(target, { recursive: true });
  cpSync(distPath, target, { recursive: true });
}

rmSync(siteRoot, { recursive: true, force: true });
mkdirSync(siteRoot, { recursive: true });

runPackageScript('@harborclient/core', 'docs:build');
runPackageScript('@harborclient/sdk', 'docs:build');

stageDist(join(repoRoot, 'packages/core/docs/.vitepress/dist'), 'core');
stageDist(join(repoRoot, 'packages/sdk/docs/.vitepress/dist'), 'sdk');

writeFileSync(
  join(siteRoot, 'index.html'),
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>HarborClient package docs</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, system-ui, sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0b1220;
        color: #e8eef7;
      }
      main {
        max-width: 40rem;
        padding: 2rem;
      }
      h1 {
        font-size: 1.75rem;
        margin: 0 0 1rem;
      }
      p {
        line-height: 1.5;
        color: #b7c4d6;
      }
      ul {
        padding-left: 1.25rem;
        line-height: 1.8;
      }
      a {
        color: #32d2e2;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>HarborClient package docs</h1>
      <p>Documentation for packages published from this monorepo:</p>
      <ul>
        <li><a href="./core/">@harborclient/core</a></li>
        <li><a href="./sdk/">@harborclient/sdk</a></li>
        <li><a href="./sdk/storybook/">SDK component Storybook</a></li>
      </ul>
    </main>
  </body>
</html>
`
);

console.log(`Combined docs site written to ${siteRoot}`);
