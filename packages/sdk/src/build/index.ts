import * as esbuild from 'esbuild';
import type { BuildOptions, Plugin } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Which JSX runtime alias (if any) the renderer bundle should use.
 *
 * - `host` — bind `react/jsx-runtime` to `@harborclient/sdk/jsx-runtime-host` for
 *   bundled third-party React libraries that import jsx-runtime at module load.
 * - `runtime` — route through the SDK runtime shims that forward to `hc.react`.
 * - `automatic` — automatic JSX with `@harborclient/sdk` import source, no alias.
 * - `none` — no JSX options (theme plugins that only register colors).
 */
export type JsxRuntimeMode = 'host' | 'runtime' | 'automatic' | 'none';

/**
 * Options for {@link buildRenderer}.
 */
export interface BuildRendererOptions {
  /** Renderer entry file. Defaults to `src/renderer.tsx`. */
  entry?: string;
  /** Output bundle path. Defaults to `dist/renderer.js`. */
  outfile?: string;
  /** When true, watch for changes instead of a one-shot build. */
  watch?: boolean;
  /** JSX runtime wiring for the bundle. Defaults to `runtime`. */
  jsxRuntime?: JsxRuntimeMode;
  /** Modules left external (provided by the HarborClient host). */
  external?: string[];
  /** esbuild `define` replacements merged into the build. */
  define?: Record<string, string>;
  /** Extra esbuild plugins appended after built-in plugins. */
  plugins?: Plugin[];
  /**
   * When set, alias `react` to this path instead of externalizing it (e.g. aws-sigv
   * proxy shim). Implies `external: []` unless `external` is explicitly provided.
   */
  aliasReactTo?: string;
  /** esbuild log level. Defaults to `info`. */
  logLevel?: BuildOptions['logLevel'];
  /**
   * Files to copy after a successful build, e.g. theme stylesheets.
   * Each pair is `[source, destination]`.
   */
  copy?: ReadonlyArray<readonly [string, string]>;
}

const JSX_RUNTIME_HOST = '@harborclient/sdk/jsx-runtime-host';
const JSX_RUNTIME = '@harborclient/sdk/jsx-runtime';
const JSX_DEV_RUNTIME = '@harborclient/sdk/jsx-dev-runtime';

/**
 * Builds the jsx-runtime alias map for the given mode.
 *
 * @param mode - JSX runtime wiring mode.
 * @returns Alias entries to merge into esbuild options, or undefined when none apply.
 */
function jsxRuntimeAliases(mode: JsxRuntimeMode): Record<string, string> | undefined {
  if (mode === 'host') {
    return {
      'react/jsx-runtime': JSX_RUNTIME_HOST,
      'react/jsx-dev-runtime': JSX_RUNTIME_HOST
    };
  }
  if (mode === 'runtime') {
    return {
      'react/jsx-runtime': JSX_RUNTIME,
      'react/jsx-dev-runtime': JSX_DEV_RUNTIME
    };
  }
  return undefined;
}

/**
 * Copies asset files after a successful renderer build.
 *
 * @param pairs - Source/destination path pairs.
 */
function copyAssets(pairs: ReadonlyArray<readonly [string, string]>): void {
  for (const [source, destination] of pairs) {
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination);
  }
}

/**
 * Bundles a HarborClient plugin renderer entry with canonical esbuild options.
 *
 * @param options - Build configuration.
 */
export async function buildRenderer(options: BuildRendererOptions = {}): Promise<void> {
  const {
    entry = 'src/renderer.tsx',
    outfile = 'dist/renderer.js',
    watch = false,
    jsxRuntime = 'runtime',
    define,
    plugins = [],
    aliasReactTo,
    logLevel = 'info',
    copy = []
  } = options;

  const external = options.external ?? (aliasReactTo ? [] : ['react', 'react-dom']);

  const alias: Record<string, string> = {
    ...jsxRuntimeAliases(jsxRuntime),
    ...(aliasReactTo ? { react: aliasReactTo } : {})
  };

  const shared: BuildOptions = {
    entryPoints: [entry],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    logLevel,
    external,
    define,
    plugins,
    ...(Object.keys(alias).length > 0 ? { alias } : {}),
    ...(jsxRuntime === 'none'
      ? {}
      : {
          jsx: 'automatic' as const,
          jsxImportSource: '@harborclient/sdk'
        })
  };

  if (watch) {
    const context = await esbuild.context(shared);
    await context.watch();
    console.log('Watching for changes…');
    return;
  }

  const context = await esbuild.context(shared);
  await context.rebuild();
  await context.dispose();

  if (copy.length > 0) {
    copyAssets(copy);
  }
}

/**
 * Escapes a string for use as a literal in a RegExp.
 *
 * @param value - Raw string to escape.
 * @returns Regex-safe literal.
 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * esbuild plugin that stubs Node built-in modules with empty exports.
 *
 * Use when a dependency imports Node modules that are unused at runtime in the
 * renderer (e.g. `dotenv` importing `fs`/`path`).
 *
 * @param moduleNames - Built-in module names to stub (e.g. `path`, `fs`).
 * @returns esbuild plugin.
 */
export function nodeBuiltinStubsPlugin(moduleNames: readonly string[]): Plugin {
  return {
    name: 'node-builtins-stub',
    setup(build) {
      for (const moduleName of moduleNames) {
        build.onResolve({ filter: new RegExp(`^${escapeRegExp(moduleName)}$`) }, () => ({
          path: moduleName,
          namespace: 'node-stub'
        }));
      }

      build.onLoad({ filter: /.*/, namespace: 'node-stub' }, () => ({
        contents: 'export default {};',
        loader: 'js'
      }));
    }
  };
}
