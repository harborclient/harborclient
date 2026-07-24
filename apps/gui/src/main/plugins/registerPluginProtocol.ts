import { protocol, session, type Session } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, sep } from 'path';
import { tmpdir } from 'os';
import { createRequire } from 'module';
import { buildSync } from 'esbuild';
import type { PluginManager } from './PluginManager';

/** Node require bound to this module, used to introspect CJS host modules. */
const nodeRequire = createRequire(__filename);

/** Matches strings that are safe to emit as ESM export binding identifiers. */
const SAFE_EXPORT_NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Cached on-disk path of the ESM shim that re-exports the shared React URL. */
let reactUrlShimPath: string | null = null;

/**
 * Writes (once) an ESM shim that re-exports the shared React host module.
 *
 * Used as an esbuild `alias` target so deeply-CommonJS modules (react-dom,
 * jsx-runtime) import React through a real ESM statement instead of an external
 * `require`, which esbuild would otherwise emit as a runtime `__require` that
 * throws "Dynamic require ... is not supported" in the browser.
 *
 * @param reactUrl - harbor-plugin URL of the shared React module.
 * @returns Absolute path to the generated shim module.
 */
function ensureReactUrlShim(reactUrl: string): string {
  if (reactUrlShimPath) {
    return reactUrlShimPath;
  }
  const shimPath = join(tmpdir(), 'harborclient-react-url-shim.mjs');
  const contents =
    `export * from ${JSON.stringify(reactUrl)};\n` +
    `export { default } from ${JSON.stringify(reactUrl)};\n`;
  writeFileSync(shimPath, contents, 'utf8');
  reactUrlShimPath = shimPath;
  return shimPath;
}

/** Custom scheme used for isolated plugin webContents documents and assets. */
export const HARBOR_PLUGIN_PROTOCOL = 'harbor-plugin';

/** Shared hostname for host-provided assets (React, CSS, view host). */
export const HARBOR_PLUGIN_HOST = 'host';

/** Cached ESM bundles for React modules served to plugin webviews. */
const reactBundleCache = new Map<string, string>();

/**
 * Registers the privileged harbor-plugin scheme before the app is ready.
 */
export function registerHarborPluginScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: HARBOR_PLUGIN_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ]);
}

/**
 * Resolves the on-disk SDK view-host bootstrap module.
 *
 * Checks the installed package and a sibling SDK checkout used during local development.
 *
 * @param appRoot - Application root containing node_modules.
 * @returns Absolute path to the view-host module, or null when none exist.
 */
function resolveViewHostPath(appRoot: string): string | null {
  const candidates = [
    join(appRoot, 'node_modules', '@harborclient', 'sdk', 'dist', 'runtime', 'viewHost.js'),
    join(
      appRoot,
      'node_modules',
      '@harborclient',
      'sdk',
      'dist',
      'runtime',
      'view-host',
      'index.js'
    ),
    join(appRoot, '..', 'harborclient-sdk', 'dist', 'runtime', 'viewHost.js'),
    join(appRoot, '..', 'harborclient-sdk', 'dist', 'runtime', 'view-host', 'index.js')
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Maps an in-asar module path to its app.asar.unpacked sibling.
 *
 * esbuild's binary runs as a child process on the real filesystem and cannot
 * read entries inside app.asar. Modules it bundles (React, the SDK view host)
 * are extracted via electron-builder asarUnpack, so rewrite their paths to the
 * real files. No-op in development where there is no asar in the path.
 *
 * @param p - Absolute path that may point inside app.asar.
 * @returns The corresponding app.asar.unpacked path, or the original path.
 */
function toUnpackedDiskPath(p: string): string {
  const marker = `${sep}app.asar${sep}`;
  return p.includes(marker) ? p.replace(marker, `${sep}app.asar.unpacked${sep}`) : p;
}

/**
 * Bundles a Node module entry as browser ESM for plugin webviews.
 *
 * @param entry - Absolute path to the module entry file.
 * @returns ESM source text.
 */
function bundleHostModule(entry: string, shareReactUrl?: string): string {
  const cacheKey = `${entry}|${shareReactUrl ?? ''}`;
  const cached = reactBundleCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // React and friends ship CommonJS. esbuild's CJS→ESM conversion emits only a
  // `default` export, so plugin bundles doing `import { forwardRef } from 'react'`
  // fail with "does not provide an export named X". Introspect the module's
  // runtime keys and re-export each as a named ESM binding alongside `default`.
  let namedExports: string[] = [];
  try {
    const moduleExports = nodeRequire(entry) as Record<string, unknown>;
    if (moduleExports && typeof moduleExports === 'object') {
      namedExports = Object.keys(moduleExports).filter(
        (key) => key !== 'default' && SAFE_EXPORT_NAME.test(key)
      );
    }
  } catch {
    // Fall back to a default-only export when introspection fails.
  }

  const wrapperSource = [
    `import __hostModule from ${JSON.stringify(entry)};`,
    'export default __hostModule;',
    namedExports.length > 0 ? `export const { ${namedExports.join(', ')} } = __hostModule;` : ''
  ].join('\n');

  // When sharing React, alias `react` to an ESM shim that re-exports the shared
  // host URL and keep that URL external. This guarantees a single React instance
  // across all host modules and plugin bundles; multiple copies break the hooks
  // dispatcher ("Invalid hook call" / "Cannot read properties of null").
  const alias = shareReactUrl ? { react: ensureReactUrlShim(shareReactUrl) } : undefined;
  const external = shareReactUrl ? [shareReactUrl] : undefined;

  const result = buildSync({
    stdin: {
      contents: wrapperSource,
      resolveDir: dirname(entry),
      loader: 'js'
    },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    ...(alias ? { alias } : {}),
    ...(external ? { external } : {})
  });
  const code = result.outputFiles[0]?.text ?? '';
  reactBundleCache.set(cacheKey, code);
  return code;
}

/** harbor-plugin React shims resolved at runtime inside plugin webviews. */
const VIEW_HOST_EXTERNALS = [
  `${HARBOR_PLUGIN_PROTOCOL}://${HARBOR_PLUGIN_HOST}/react.js`,
  `${HARBOR_PLUGIN_PROTOCOL}://${HARBOR_PLUGIN_HOST}/react-dom.js`,
  `${HARBOR_PLUGIN_PROTOCOL}://${HARBOR_PLUGIN_HOST}/react-dom-client.js`
];

/**
 * Bundles the SDK view-host entry and its relative runtime modules for browser ESM.
 *
 * Dynamic React imports stay external so they continue to load from harbor-plugin://host/* .
 *
 * @param entry - Absolute path to viewHost.js.
 * @returns Bundled ESM source text.
 */
function bundleViewHostModule(entry: string): string {
  const cacheKey = `view-host:${entry}`;
  const cached = reactBundleCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const result = buildSync({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    write: false,
    external: VIEW_HOST_EXTERNALS
  });
  const code = result.outputFiles[0]?.text ?? '';
  reactBundleCache.set(cacheKey, code);
  return code;
}

/**
 * Resolves the compiled renderer stylesheet(s) for production plugin surfaces.
 *
 * Vite emits the host CSS with a content hash (assets/index-[hash].css), so the
 * filename is not stable. Parse the built index.html for its stylesheet links —
 * the same CSS the host renderer loads — and return the concatenated contents.
 *
 * @param appRoot - Application root containing out/renderer.
 * @returns Combined CSS text, or null when the built renderer is unavailable.
 */
function readBuiltHostCss(appRoot: string): string | null {
  const htmlPath = join(appRoot, 'out/renderer/index.html');
  if (!existsSync(htmlPath)) {
    return null;
  }
  const html = readFileSync(htmlPath, 'utf8');
  const hrefs = [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)]
    .map((tag) => /href=["']([^"']+)["']/i.exec(tag[0])?.[1])
    .filter((href): href is string => Boolean(href));
  const rendererDir = join(appRoot, 'out/renderer');
  const parts: string[] = [];
  for (const href of hrefs) {
    const cssPath = join(rendererDir, href.replace(/^\.?\//, ''));
    if (existsSync(cssPath)) {
      parts.push(readFileSync(cssPath, 'utf8'));
    }
  }
  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * Serves the host stylesheet that plugin webviews link against.
 *
 * The on-disk `styles.css` is Tailwind v4 source (`@import 'tailwindcss'`,
 * `@theme`, `@source`) that a browser cannot resolve on its own, so serving it
 * raw leaves plugin surfaces without any utility classes (borders, backgrounds,
 * radii, shadows) — the SDK `CodeEditor` and other components render unstyled.
 *
 * In dev we fetch the compiled CSS from the running Vite dev server (`?direct`
 * returns the post-processed Tailwind output as text/css), guaranteeing the
 * exact same utilities the host renderer uses. In production we serve the
 * already-compiled renderer bundle. Both paths fall back to the raw source so a
 * surface still gets the CSS variables when compilation is unavailable.
 *
 * @param appRoot - Application root for resolving the built/source CSS.
 * @returns CSS response for `harbor-plugin://host/styles.css`.
 */
async function serveHostStyles(appRoot: string): Promise<Response> {
  const cssHeaders = { 'Content-Type': 'text/css' } as const;
  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devServerUrl) {
    try {
      // Bound the request: the agent/view shell.html blocks on this stylesheet,
      // so a stalled dev server (e.g. mid-restart) must not hang plugin webview
      // bootstrap and trip the agent-ready timeout. Fall back to on-disk CSS.
      const response = await fetch(`${devServerUrl.replace(/\/$/, '')}/src/styles.css?direct`, {
        signal: AbortSignal.timeout(2000)
      });
      if (response.ok) {
        return new Response(await response.text(), { headers: cssHeaders });
      }
    } catch {
      // Dev server unreachable/slow; fall back to on-disk CSS below.
    }
  }

  const builtCss = readBuiltHostCss(appRoot);
  if (builtCss !== null) {
    return new Response(builtCss, { headers: cssHeaders });
  }

  const devCss = join(appRoot, 'src/renderer/src/styles.css');
  if (existsSync(devCss)) {
    return new Response(readFileSync(devCss, 'utf8'), { headers: cssHeaders });
  }

  return new Response('/* missing host styles */', { headers: cssHeaders });
}

/**
 * Builds a Response for harbor-plugin://host/* assets.
 *
 * @param pathname - Request pathname after the hostname.
 * @param appRoot - Application root for resolving SDK and React packages.
 */
async function serveHostAsset(pathname: string, appRoot: string): Promise<Response> {
  if (pathname === '/styles.css') {
    return serveHostStyles(appRoot);
  }

  if (pathname === '/view-host.js') {
    const viewHostPath = resolveViewHostPath(appRoot);
    if (!viewHostPath) {
      return new Response(
        'View host module is missing. Rebuild @harborclient/sdk (pnpm build) and reinstall the app.',
        { status: 404 }
      );
    }
    return new Response(bundleViewHostModule(toUnpackedDiskPath(viewHostPath)), {
      headers: { 'Content-Type': 'text/javascript' }
    });
  }

  if (pathname === '/bootstrap.js') {
    const prodBootstrap = join(__dirname, 'pluginBootstrap.js');
    const devBootstrap = join(__dirname, '../../src/main/plugins/pluginBootstrap.js');
    const bootstrapPath = existsSync(prodBootstrap) ? prodBootstrap : devBootstrap;
    return new Response(readFileSync(bootstrapPath, 'utf8'), {
      headers: { 'Content-Type': 'text/javascript' }
    });
  }

  const reactRoot = toUnpackedDiskPath(join(appRoot, 'node_modules', 'react'));
  const reactDomRoot = toUnpackedDiskPath(join(appRoot, 'node_modules', 'react-dom'));
  const reactUrl = `${HARBOR_PLUGIN_PROTOCOL}://${HARBOR_PLUGIN_HOST}/react.js`;

  if (pathname === '/react.js') {
    return new Response(bundleHostModule(join(reactRoot, 'index.js')), {
      headers: { 'Content-Type': 'text/javascript' }
    });
  }

  if (pathname === '/react-dom.js') {
    return new Response(bundleHostModule(join(reactDomRoot, 'index.js'), reactUrl), {
      headers: { 'Content-Type': 'text/javascript' }
    });
  }

  if (pathname === '/react-dom-client.js') {
    return new Response(bundleHostModule(join(reactDomRoot, 'client.js'), reactUrl), {
      headers: { 'Content-Type': 'text/javascript' }
    });
  }

  if (pathname === '/jsx-runtime.js') {
    return new Response(bundleHostModule(join(reactRoot, 'jsx-runtime.js'), reactUrl), {
      headers: { 'Content-Type': 'text/javascript' }
    });
  }

  return new Response('Not found', { status: 404 });
}

/**
 * Builds a Response for harbor-plugin://{pluginId}/* assets.
 *
 * @param pluginId - Plugin manifest id from the URL hostname.
 * @param pathname - Request pathname.
 * @param pluginManager - Plugin manager for reading plugin files.
 * @param onAgentReady - Callback invoked when an agent webview finishes bootstrapping.
 * @param onAgentFailed - Callback invoked when agent bootstrap fails.
 */
async function servePluginAsset(
  request: Request,
  pluginId: string,
  pathname: string,
  pluginManager: PluginManager,
  onAgentReady: (pluginId: string) => void,
  onAgentFailed?: (pluginId: string, message: string) => void
): Promise<Response> {
  if (pathname === '/shell.html' || pathname === '/shell.html/') {
    const prodShell = join(__dirname, 'pluginShell.html');
    const devShell = join(__dirname, '../../src/main/plugins/pluginShell.html');
    const shellPath = existsSync(prodShell) ? prodShell : devShell;
    return new Response(readFileSync(shellPath, 'utf8'), {
      headers: { 'Content-Type': 'text/html' }
    });
  }

  if (pathname === '/manifest.json') {
    const plugin = pluginManager.get(pluginId);
    if (!plugin) {
      return new Response('Unknown plugin', { status: 404 });
    }
    return new Response(JSON.stringify(plugin.manifest), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (pathname === '/bundle.js') {
    try {
      const source = pluginManager.readEntrySource(pluginId, 'renderer');
      const reactShim = `${HARBOR_PLUGIN_PROTOCOL}://${HARBOR_PLUGIN_HOST}/react.js`;
      const reactDomShim = `${HARBOR_PLUGIN_PROTOCOL}://${HARBOR_PLUGIN_HOST}/react-dom.js`;
      const jsxRuntimeShim = `${HARBOR_PLUGIN_PROTOCOL}://${HARBOR_PLUGIN_HOST}/jsx-runtime.js`;
      const patched = source
        .replace(/from\s*(["'])react\1/g, `from ${JSON.stringify(reactShim)}`)
        .replace(/from\s*(["'])react-dom\1/g, `from ${JSON.stringify(reactDomShim)}`)
        .replace(/from\s*(["'])react\/jsx-runtime\1/g, `from ${JSON.stringify(jsxRuntimeShim)}`);
      return new Response(patched, {
        headers: { 'Content-Type': 'text/javascript' }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return new Response(message, { status: 404 });
    }
  }

  if (pathname === '/agent-ready') {
    onAgentReady(pluginId);
    return new Response('ok', { status: 200 });
  }

  if (pathname === '/agent-error' && request.method === 'POST') {
    const message = (await request.text()).trim() || 'Plugin agent webview failed to activate.';
    onAgentFailed?.(pluginId, message);
    return new Response('ok', { status: 200 });
  }

  return new Response('Not found', { status: 404 });
}

/** Handler signature shared by the default session and plugin partition sessions. */
type HarborPluginHandler = (request: Request) => Promise<Response>;

/** Configured handler, set once at startup and reused for partition sessions. */
let harborPluginHandler: HarborPluginHandler | null = null;

/** Partitions that already have the harbor-plugin handler registered. */
const registeredPartitions = new Set<string>();

/**
 * Builds the harbor-plugin request handler bound to the plugin manager and callbacks.
 *
 * @param pluginManager - Initialized plugin manager.
 * @param appRoot - Application root directory.
 * @param onAgentReady - Notifies the UI broker when an agent webview activates.
 * @param onAgentFailed - Notifies the UI broker when agent bootstrap fails.
 * @returns Async protocol handler for harbor-plugin:// requests.
 */
function createHarborPluginHandler(
  pluginManager: PluginManager,
  appRoot: string,
  onAgentReady: (pluginId: string) => void,
  onAgentFailed?: (pluginId: string, message: string) => void
): HarborPluginHandler {
  return async (request) => {
    const url = new URL(request.url);
    const hostname = decodeURIComponent(url.hostname);
    const pathname = url.pathname || '/';

    let response: Response;
    if (hostname === HARBOR_PLUGIN_HOST) {
      response = await serveHostAsset(pathname, appRoot);
    } else {
      response = await servePluginAsset(
        request,
        hostname,
        pathname,
        pluginManager,
        onAgentReady,
        onAgentFailed
      );
    }

    // Plugin and host assets are generated/served from local sources that change
    // when a plugin or the linked SDK is rebuilt. Persistent plugin partition
    // sessions would otherwise cache them and replay stale modules, so opt out.
    try {
      response.headers.set('Cache-Control', 'no-store');
    } catch {
      // Some Response instances expose immutable headers; ignore when unset.
    }

    return response;
  };
}

/**
 * Registers the harbor-plugin handler on one session if not already present.
 *
 * @param targetSession - Electron session to register the handler on.
 * @param label - Partition label used to deduplicate registrations.
 */
function registerHandlerOnSession(targetSession: Session, label: string): void {
  if (!harborPluginHandler || registeredPartitions.has(label)) {
    return;
  }
  if (targetSession.protocol.isProtocolHandled(HARBOR_PLUGIN_PROTOCOL)) {
    registeredPartitions.add(label);
    return;
  }
  targetSession.protocol.handle(HARBOR_PLUGIN_PROTOCOL, harborPluginHandler);
  registeredPartitions.add(label);
}

/**
 * Ensures the harbor-plugin protocol handler is registered on a partition session.
 *
 * Plugin webviews run in `persist:plugin-<id>` partitions, each backed by its own
 * Electron session. The default-session handler does not apply to those sessions,
 * so this must run before a plugin webview begins loading harbor-plugin:// assets.
 *
 * @param partition - Partition string, for example `persist:plugin-com.example`.
 */
export function ensureHarborPluginProtocolForSession(partition: string): void {
  registerHandlerOnSession(session.fromPartition(partition), partition);
}

/**
 * Installs the harbor-plugin protocol handler after the app is ready.
 *
 * @param pluginManager - Initialized plugin manager.
 * @param appRoot - Application root directory.
 * @param onAgentReady - Notifies the UI broker when an agent webview activates.
 * @param onAgentFailed - Notifies the UI broker when agent bootstrap fails.
 */
export function registerHarborPluginProtocol(
  pluginManager: PluginManager,
  appRoot: string,
  onAgentReady: (pluginId: string) => void,
  onAgentFailed?: (pluginId: string, message: string) => void
): void {
  harborPluginHandler = createHarborPluginHandler(
    pluginManager,
    appRoot,
    onAgentReady,
    onAgentFailed
  );
  protocol.handle(HARBOR_PLUGIN_PROTOCOL, harborPluginHandler);
}
