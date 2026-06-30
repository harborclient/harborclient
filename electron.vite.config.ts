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

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['ses'] }), copyPluginStaticAssets()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          scriptRunner: resolve(__dirname, 'src/main/scripting/scriptRunner.ts'),
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
    plugins: [externalizeDepsPlugin()],
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
    // Force dependency pre-bundling on every dev start. Vite caches optimized
    // deps in node_modules/.vite/deps keyed on a hash of the lockfile and config,
    // not on `file:`-linked package contents. Without forcing, a local
    // `@harborclient/sdk` rebuild is never picked up: Vite keeps serving the
    // stale pre-bundled copy even after `pnpm install` and a dev-server restart.
    // Re-optimizing each start keeps the linked SDK fresh without changing module
    // resolution (excluding it from bundling breaks its transitive deps).
    optimizeDeps: {
      force: true
    },
    resolve: {
      alias: {
        '@images': resolve(__dirname, 'images'),
        '@harborclient/sdk/react': resolve(__dirname, 'node_modules/react'),
        '@harborclient/sdk/jsx-runtime': resolve(__dirname, 'node_modules/react/jsx-runtime')
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
