/**
 * Electron-vite configuration for main, preload, and renderer processes.
 * Main externalizes native deps (better-sqlite3); renderer uses React.
 */
import { copyFileSync } from 'fs';
import { join, resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

/** Static plugin webview assets served by the harbor-plugin protocol handler. */
const PLUGIN_STATIC_ASSETS = ['pluginShell.html', 'pluginBootstrap.js'] as const;

/**
 * CodeMirror packages that must resolve to a single copy in the renderer bundle.
 * A linked `@harborclient/sdk` installs its own `@codemirror/*` tree; mixing those
 * extensions with the host app's copies breaks CodeMirror instanceof checks.
 */
const CODEMIRROR_DEDUPE_PACKAGES = [
  '@codemirror/autocomplete',
  '@codemirror/lang-javascript',
  '@codemirror/lang-json',
  '@codemirror/language',
  '@codemirror/lint',
  '@codemirror/legacy-modes',
  '@codemirror/state',
  '@codemirror/view',
  '@lezer/highlight',
  '@uiw/codemirror-themes-all',
  '@uiw/react-codemirror'
] as const;

/**
 * Builds Vite resolve aliases that pin CodeMirror imports to this app's node_modules.
 *
 * @returns Alias map for renderer resolve configuration.
 */
function buildCodemirrorAliases(): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const packageName of CODEMIRROR_DEDUPE_PACKAGES) {
    aliases[packageName] = resolve(__dirname, 'node_modules', ...packageName.split('/'));
  }
  return aliases;
}

/**
 * SDK subpath → source entry pairs the GUI imports at runtime.
 * Do not alias the bare `@harborclient/sdk` package: Vite treats string aliases as
 * prefixes, so mapping it to `index.ts` would resolve `@harborclient/sdk/react-dom`
 * as `index.ts/react-dom`. The GUI only imports the bare package as `import type`,
 * which is erased before resolve. Host React overrides (`sdk/react`, `sdk/react-dom`,
 * `sdk/jsx-runtime`, `sdk/jsx-dev-runtime`) stay in the renderer alias map separately.
 */
const HARBOR_SDK_SOURCE_ENTRIES = [
  ['@harborclient/sdk/components', 'components/index.ts'],
  ['@harborclient/sdk/variables', 'variables/index.ts'],
  ['@harborclient/sdk/ui', 'ui/index.ts'],
  ['@harborclient/sdk/signing', 'signing/index.ts'],
  ['@harborclient/sdk/styles.css', 'styles.css']
] as const;

/**
 * Builds Vite resolve aliases that point `@harborclient/sdk` imports at the SDK
 * source tree instead of `dist/`. Matching core/http/storage-sqlite, this lets
 * HMR update individual TSX files without waiting on `tsc --watch` to rewrite
 * `packages/sdk/dist` (which previously invalidated the whole renderer CSS graph).
 *
 * @returns Alias map for main, preload, and renderer resolve configuration.
 */
function buildHarborSdkSourceAliases(): Record<string, string> {
  const sdkSrc = resolve(__dirname, '../../packages/sdk/src');
  const aliases: Record<string, string> = {};
  for (const [importPath, relativeEntry] of HARBOR_SDK_SOURCE_ENTRIES) {
    aliases[importPath] = resolve(sdkSrc, relativeEntry);
  }
  return aliases;
}

/**
 * Prepended to main-process bundles so ESBUILD_BINARY_PATH is set before hoisted
 * require("esbuild") runs in packaged apps (asar cannot execute nested binaries).
 */
const ESBUILD_BINARY_PATH_BANNER = [
  '"use strict";',
  '(function(){"use strict";try{',
  'if(process.env.ESBUILD_BINARY_PATH)return;',
  'var rp=process.resourcesPath;if(!rp)return;',
  'var p=require("path");var f=require("fs");',
  'var pkg="@esbuild/"+process.platform+"-"+process.arch;',
  'var sub=process.platform==="win32"?"esbuild.exe":p.join("bin","esbuild");',
  'var bin=p.join(rp,"app.asar.unpacked","node_modules",pkg,sub);',
  'if(f.existsSync(bin))process.env.ESBUILD_BINARY_PATH=bin;',
  '}catch(e){}})();'
].join('');

/**
 * Copies plugin shell assets into the main build output so packaged apps can
 * serve harbor-plugin:// shell.html and bootstrap.js without src/ fallbacks.
 */
function copyPluginStaticAssets(): Plugin {
  return {
    name: 'copy-plugin-static-assets',
    writeBundle(options: { dir?: string }) {
      const outDir = options.dir ?? resolve(__dirname, 'out/main');
      for (const file of PLUGIN_STATIC_ASSETS) {
        copyFileSync(resolve(__dirname, 'src/main/plugins', file), join(outDir, file));
      }
    }
  };
}

/** Resolves workspace package deep imports to their source trees. */
const harborWorkspaceAliases = {
  '@harborclient/core': resolve(__dirname, '../../packages/core/src'),
  '@harborclient/http': resolve(__dirname, '../../packages/http/src'),
  '@harborclient/storage-sqlite': resolve(__dirname, '../../packages/storage-sqlite/src'),
  '@harborclient/team-hub-api': resolve(__dirname, '../../packages/team-hub-api/src'),
  ...buildHarborSdkSourceAliases()
};

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          'ses',
          '@harborclient/core',
          '@harborclient/http',
          '@harborclient/storage-sqlite',
          '@harborclient/team-hub-api',
          '@harborclient/sdk'
        ]
      }),
      copyPluginStaticAssets()
    ],
    resolve: {
      alias: harborWorkspaceAliases
    },
    build: {
      rollupOptions: {
        input: {
          // Product router bootstrap — classifies argv before loading GUI main.
          index: resolve(__dirname, '../harborclient/src/index.ts'),
          scriptRunner: resolve(__dirname, '../../packages/core/src/scripting/scriptRunner.ts'),
          pluginRunner: resolve(__dirname, 'src/main/plugins/pluginRunner.ts')
        },
        external: ['better-sqlite3'],
        output: {
          entryFileNames: '[name].js',
          banner: ESBUILD_BINARY_PATH_BANNER
        }
      }
    }
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          '@harborclient/core',
          '@harborclient/http',
          '@harborclient/storage-sqlite',
          '@harborclient/team-hub-api',
          '@harborclient/sdk'
        ]
      })
    ],
    resolve: {
      alias: harborWorkspaceAliases
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          plugin: resolve(__dirname, 'src/preload/plugin.ts')
        }
      }
    }
  },
  renderer: {
    // Pin the dev server to a fixed port so the renderer origin
    // (http://localhost:5173) stays stable across restarts. Chromium scopes
    // localStorage by origin, so a drifting port would orphan persisted state
    // such as open request tabs (harborclient.openTabs). strictPort fails loudly
    // on a conflict instead of silently switching ports and losing that state.
    server: {
      port: 5173,
      strictPort: true
    },
    plugins: [react(), tailwindcss()],
    // Splash and other static HTML entry points load assets from here. Using
    // `./logo.png` in splash.html keeps dev (Vite server) and production
    // (file:// loadFile) URLs aligned without bundling the logo into hashed assets.
    publicDir: resolve(__dirname, '../../images'),
    // SDK (and other workspace packages) resolve to source via harborWorkspaceAliases,
    // so Vite no longer pre-bundles a stale `file:`-linked `dist/` copy. If optimized
    // deps ever look stale after a dependency change, clear the cache once with
    // `rm -rf apps/gui/node_modules/.vite`.
    resolve: {
      dedupe: [...CODEMIRROR_DEDUPE_PACKAGES],
      alias: {
        '@images': resolve(__dirname, '../../images'),
        ...harborWorkspaceAliases,
        // Host React: SDK source uses `jsxImportSource: '@harborclient/sdk'`, so Vite
        // emits imports of `@harborclient/sdk/jsx-runtime` (prod) and
        // `@harborclient/sdk/jsx-dev-runtime` (dev). Pin those — and the react shims —
        // to this app's React so the GUI does not require plugin `installReact()`.
        '@harborclient/sdk/react': resolve(__dirname, 'node_modules/react'),
        '@harborclient/sdk/react-dom': resolve(__dirname, 'node_modules/react-dom'),
        '@harborclient/sdk/jsx-runtime': resolve(__dirname, 'node_modules/react/jsx-runtime'),
        '@harborclient/sdk/jsx-dev-runtime': resolve(
          __dirname,
          'node_modules/react/jsx-dev-runtime'
        ),
        ...buildCodemirrorAliases()
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          splash: resolve(__dirname, 'src/renderer/splash.html')
        }
      }
    }
  }
});
