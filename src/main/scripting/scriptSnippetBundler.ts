import { build, type Plugin } from 'esbuild';
import { dirname, join, normalize as posixNormalize } from 'node:path';

/** esbuild target for bundled user script output. */
const SCRIPT_BUNDLE_TARGET = 'es2022';

/** Virtual path of the running script entry module. */
export const SCRIPT_ENTRY_VIRTUAL_PATH = '/__entry__.js';

/** esbuild namespace for the user script entry module. */
const ENTRY_NAMESPACE = 'hc-entry';

/** esbuild namespace for resolved snippet modules. */
const SNIPPET_NAMESPACE = 'hc-snippet';

/**
 * Returns whether user script source uses ESM import or export syntax.
 *
 * Used to choose the bundling path; false positives only skip an unnecessary
 * fast path, while false negatives would fail esbuild transform instead.
 *
 * @param source - Raw user-authored script source.
 * @returns True when the source likely contains module syntax.
 */
export function scriptUsesModuleSyntax(source: string): boolean {
  return /\b(import\s*(?:[\w*{]|['"]|\.|\/)|export\s*(?:default|[\w*{]))/.test(source);
}

/**
 * Resolves a relative import specifier against a virtual snippet filesystem path.
 *
 * @param importerPath - Absolute virtual path of the importing module.
 * @param specifier - Relative import string from the import statement.
 * @returns Normalized snippet filename key (no leading slash).
 */
export function resolveSnippetImportPath(importerPath: string, specifier: string): string {
  const joined = posixNormalize(join(dirname(importerPath), specifier));
  return joined.replace(/^\//, '');
}

/**
 * Builds an esbuild plugin that resolves relative imports against snippet modules.
 *
 * @param entrySource - JavaScript source for the running script slot.
 * @param modules - Snippet sources keyed by import filename.
 * @param conflicts - Filenames that map to more than one snippet row.
 * @returns esbuild plugin for virtual entry and snippet modules.
 */
export function createSnippetImportPlugin(
  entrySource: string,
  modules: Record<string, string>,
  conflicts: string[]
): Plugin {
  const conflictSet = new Set(conflicts);

  /**
   * Loads snippet source or returns a descriptive resolve/load error.
   *
   * @param snippetKey - Normalized snippet filename key.
   * @returns esbuild onLoad result with snippet source or an error.
   */
  const loadSnippetByKey = (
    snippetKey: string
  ): { contents: string; loader: 'js' } | { errors: Array<{ text: string }> } => {
    if (conflictSet.has(snippetKey)) {
      return {
        errors: [{ text: `Ambiguous import: multiple snippets named "${snippetKey}"` }]
      };
    }

    const source = modules[snippetKey];
    if (source === undefined) {
      return {
        errors: [{ text: `Cannot find snippet "${snippetKey}"` }]
      };
    }

    return { contents: source, loader: 'js' };
  };

  return {
    name: 'hc-snippet-import',
    setup(buildContext) {
      buildContext.onResolve({ filter: /^\.\/__entry__\.js$/ }, () => ({
        path: SCRIPT_ENTRY_VIRTUAL_PATH,
        namespace: ENTRY_NAMESPACE
      }));

      buildContext.onResolve({ filter: /^\.\.?\//, namespace: ENTRY_NAMESPACE }, (args) => ({
        path: `/${resolveSnippetImportPath(args.importer, args.path)}`,
        namespace: SNIPPET_NAMESPACE
      }));

      buildContext.onResolve({ filter: /^\.\.?\//, namespace: SNIPPET_NAMESPACE }, (args) => ({
        path: `/${resolveSnippetImportPath(args.importer, args.path)}`,
        namespace: SNIPPET_NAMESPACE
      }));

      buildContext.onResolve({ filter: /^[^./]/, namespace: ENTRY_NAMESPACE }, (args) => ({
        errors: [{ text: `Package imports are not supported yet: "${args.path}"` }]
      }));

      buildContext.onResolve({ filter: /^[^./]/, namespace: SNIPPET_NAMESPACE }, (args) => ({
        errors: [{ text: `Package imports are not supported yet: "${args.path}"` }]
      }));

      buildContext.onLoad({ filter: /.*/, namespace: ENTRY_NAMESPACE }, () => ({
        contents: entrySource,
        loader: 'js',
        resolveDir: '/'
      }));

      buildContext.onLoad({ filter: /.*/, namespace: SNIPPET_NAMESPACE }, (args) => {
        const snippetKey = args.path.replace(/^\//, '');
        return loadSnippetByKey(snippetKey);
      });
    }
  };
}

/**
 * Bundles a user script and its relative snippet imports into a single ESM file.
 *
 * The synthetic stdin entry side-effect-imports the user script so top-level
 * exports in the entry are internalized by the bundler while entry statements
 * still execute.
 *
 * @param source - Raw user-authored script source for the running slot.
 * @param modules - Snippet sources keyed by import filename.
 * @param conflicts - Filenames that map to more than one snippet row.
 * @returns Bundled JavaScript with imports resolved and inlined.
 * @throws esbuild build errors when the script or imports are invalid.
 */
export async function bundleUserScript(
  source: string,
  modules: Record<string, string>,
  conflicts: string[]
): Promise<string> {
  const result = await build({
    stdin: {
      contents: 'import "./__entry__.js";',
      loader: 'js',
      resolveDir: '/',
      sourcefile: 'script-entry.js'
    },
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: SCRIPT_BUNDLE_TARGET,
    write: false,
    logLevel: 'silent',
    treeShaking: true,
    plugins: [createSnippetImportPlugin(source, modules, conflicts)]
  });

  const output = result.outputFiles[0]?.text;
  if (!output) {
    throw new Error('Script bundling produced no output');
  }

  return output;
}
