#!/usr/bin/env node
/**
 * Builds the GitHub Pages stub site for package docs.
 *
 * Canonical package documentation now lives on harborclient.com under `/core/`,
 * `/sdk/`, and `/http/`. This script still publishes SDK Storybook under
 * `/harborclient/sdk/storybook/` and emits redirect HTML for the former VitePress
 * doc routes so old GitHub Pages links (and the archived sdk/http redirect hops)
 * land on harborclient.com.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = join(repoRoot, '_site');
const siteOrigin = 'https://harborclient.com';

/**
 * Package doc routes that previously lived on GitHub Pages.
 *
 * Empty string is the package overview (`/<slug>/`). Nested paths such as
 * `examples/request-logger` become `/<slug>/examples/request-logger`.
 *
 * @type {Record<string, string[]>}
 */
const packageRoutes = {
  core: [
    '',
    'installation',
    'package-layout',
    'imports-and-exports',
    'request-runner',
    'scripting',
    'types-and-ipc-contract',
    'development'
  ],
  sdk: [
    '',
    'install',
    'usage',
    'package-layout',
    'manifest',
    'permissions',
    'architecture',
    'building',
    'signing',
    'dev-workflow',
    'api/',
    'api/ui',
    'api/actions',
    'api/themes',
    'api/commands',
    'api/storage',
    'api/database',
    'api/fs',
    'api/http',
    'api/ipc',
    'api/host',
    'api/imports',
    'api/mcp',
    'api/liveServers',
    'api/livePages',
    'api/livePage',
    'api/ai',
    'api/server',
    'api/scripts',
    'api/pluginId',
    'api/react',
    'api-index',
    'snippets',
    'examples/',
    'examples/request-logger',
    'examples/request-audit-tab',
    'examples/solarized-theme',
    'examples/import-handler',
    'examples/mcp-client-server',
    'marketplace',
    'performance',
    'vs-request-scripts',
    'license'
  ],
  http: ['', 'installation', 'usage', 'development', 'license']
};

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
 * Former package doc routes that now live under a different path on harborclient.com.
 *
 * Keys are `${packageSlug}/${routePath}`; values are the replacement path under that
 * package (may include a hash). Keeps GitHub Pages stubs working after merges.
 *
 * @type {Record<string, string>}
 */
const routeAliases = {
  'sdk/package-layout': 'manifest#package-layout'
};

/**
 * Builds the harborclient.com destination URL for a package docs path.
 *
 * @param {string} packageSlug - Package URL segment.
 * @param {string} routePath - Path under the package, or empty for the overview.
 * @returns {string} Absolute destination URL.
 */
function destinationUrl(packageSlug, routePath) {
  const alias = routeAliases[`${packageSlug}/${routePath}`];
  const resolvedPath = alias ?? routePath;

  if (!resolvedPath) {
    return `${siteOrigin}/${packageSlug}/`;
  }

  if (resolvedPath.endsWith('/')) {
    return `${siteOrigin}/${packageSlug}/${resolvedPath}`;
  }

  return `${siteOrigin}/${packageSlug}/${resolvedPath}`;
}

/**
 * Builds a minimal HTML redirect page that preserves hash fragments.
 *
 * When the destination already includes a hash (route alias), the incoming
 * `location.hash` is ignored so aliases are not doubled.
 *
 * @param {string} destination - Absolute URL to redirect to.
 * @returns {string} HTML document contents.
 */
function buildRedirectHtml(destination) {
  const escaped = destination.replace(/"/g, '&quot;');
  const hasHash = destination.includes('#');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0; url=${escaped}" />
    <link rel="canonical" href="${escaped}" />
    <title>Redirecting…</title>
    <script>
      (function () {
        var destination = ${JSON.stringify(destination)};
        var hasHash = ${JSON.stringify(hasHash)};
        location.replace(hasHash ? destination : destination + location.hash);
      })();
    </script>
  </head>
  <body>
    <p>
      Documentation has moved to
      <a href="${escaped}">${escaped}</a>.
    </p>
  </body>
</html>
`;
}

/**
 * Writes redirect HTML for one package docs route.
 *
 * @param {string} packageSlug - Package URL segment.
 * @param {string} routePath - Path under the package, or empty for the overview.
 * @returns {void}
 */
function writePackageRedirect(packageSlug, routePath) {
  const destination = destinationUrl(packageSlug, routePath);
  const html = buildRedirectHtml(destination);

  if (!routePath || routePath === '/') {
    const dir = join(siteRoot, packageSlug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
    return;
  }

  if (routePath.endsWith('/')) {
    const dir = join(siteRoot, packageSlug, routePath.replace(/\/$/, ''));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
    return;
  }

  const segments = routePath.split('/');
  const fileName = `${segments.pop()}.html`;
  const dir = join(siteRoot, packageSlug, ...segments);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, fileName), html);
}

/**
 * Builds the GitHub Pages 404 catch-all that remaps unknown package doc paths.
 *
 * Storybook under `/harborclient/sdk/storybook/` is excluded so missing Storybook
 * assets stay on Pages instead of bouncing to harborclient.com.
 *
 * @returns {string} HTML document contents.
 */
function buildCatchAllHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redirecting…</title>
    <script>
      (function () {
        var match = location.pathname.match(
          /^\\/harborclient\\/(sdk|core|http)(?:\\/(.*))?$/
        );

        if (!match) {
          document.title = 'Not found';
          document.body.innerHTML =
            '<main><h1>Not found</h1><p>This page is not part of the HarborClient docs redirect site.</p></main>';
          return;
        }

        var pkg = match[1];
        var rest = match[2] || '';

        if (pkg === 'sdk' && rest.indexOf('storybook') === 0) {
          document.title = 'Not found';
          document.body.innerHTML =
            '<main><h1>Not found</h1><p>SDK Storybook asset missing.</p></main>';
          return;
        }

        var destination =
          ${JSON.stringify(siteOrigin + '/')} +
          pkg +
          '/' +
          rest +
          location.search +
          location.hash;
        location.replace(destination);
      })();
    </script>
  </head>
  <body>
    <p>Redirecting to the HarborClient documentation site…</p>
  </body>
</html>
`;
}

rmSync(siteRoot, { recursive: true, force: true });
mkdirSync(siteRoot, { recursive: true });

runPackageScript('@harborclient/sdk', 'build-storybook');

const storybookDist = join(
  repoRoot,
  'packages/sdk/docs/.vitepress/static/storybook'
);
const storybookTarget = join(siteRoot, 'sdk', 'storybook');
mkdirSync(join(siteRoot, 'sdk'), { recursive: true });
cpSync(storybookDist, storybookTarget, { recursive: true });

for (const [packageSlug, routes] of Object.entries(packageRoutes)) {
  for (const routePath of routes) {
    writePackageRedirect(packageSlug, routePath);
  }
}

writeFileSync(join(siteRoot, '404.html'), buildCatchAllHtml());

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
      <p>
        Package documentation now lives on
        <a href="${siteOrigin}/">harborclient.com</a>:
      </p>
      <ul>
        <li><a href="${siteOrigin}/core/">@harborclient/core</a></li>
        <li><a href="${siteOrigin}/sdk/">@harborclient/sdk</a></li>
        <li><a href="${siteOrigin}/http/">@harborclient/http</a></li>
        <li>
          <a href="./sdk/storybook/">SDK component Storybook</a>
          (still hosted on GitHub Pages)
        </li>
      </ul>
    </main>
  </body>
</html>
`
);

console.log(`Docs redirect site written to ${siteRoot}`);
