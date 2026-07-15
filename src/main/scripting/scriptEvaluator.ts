import 'ses';
import { transform } from 'esbuild';
import type { ScriptRunInput, ScriptRunResult } from '#/shared/types';
import { normalizeAuth } from '#/shared/auth';
import { createScriptApi, type ScriptApiOptions } from './scriptApi';
import { bundleUserScript, scriptUsesModuleSyntax } from './scriptSnippetBundler';

/** esbuild target for lowering modern user script syntax before compartment execution. */
const SCRIPT_TRANSPILE_TARGET = 'es2020';

/**
 * Builds the passthrough result returned when a script is empty or on failure.
 *
 * @param input - Script run input carrying the current request context.
 * @returns Baseline result with no mutations, tests, or logs.
 */
export function buildScriptPassthrough(input: ScriptRunInput): ScriptRunResult {
  return {
    request: input.request,
    variableSets: {},
    variableClears: [],
    collectionVariableSets: {},
    collectionVariableClears: [],
    folderVariableSets: {},
    folderVariableClears: [],
    environmentVariableSets: {},
    environmentVariableClears: [],
    globalVariableSets: {},
    globalVariableClears: [],
    cookieSets: {},
    cookieClears: [],
    collectionHeaders: input.collection?.headers ?? [],
    collectionAuth: normalizeAuth(input.collection?.auth),
    folderHeaders: input.folder?.headers ?? [],
    folderAuth: normalizeAuth(input.folder?.auth),
    tests: [],
    logs: [],
    executionEvents: [],
    data: input.data ?? {}
  };
}

/**
 * Strips filesystem paths and runtime framing from script errors before they reach the UI.
 *
 * User scripts and the sandbox runtime can embed absolute paths or eval framing locations
 * that are useful for main-process debugging but should not appear in the renderer.
 *
 * @param message - Raw error message from the script sandbox.
 * @returns Single-line message with absolute paths replaced by `[path]`.
 */
export function sanitizeScriptErrorMessage(message: string): string {
  const firstLine = message.split('\n')[0]?.trim() ?? '';
  if (!firstLine) {
    return 'Script execution failed';
  }

  let sanitized = firstLine.replace(/evalmachine\.<anonymous>/g, 'script');

  sanitized = sanitized
    .replace(/[A-Za-z]:[\\/][^\s'"(),\]}]+/g, '[path]')
    .replace(/(^|[\s(,])(\/(?:[\w.-]+\/)+[\w.-]*)/g, '$1[path]');

  return sanitized;
}

/**
 * Formats an esbuild transform failure into a single-line message for the UI.
 *
 * @param err - Thrown esbuild error or unknown value.
 * @returns Human-readable compile error text, optionally with line/column.
 */
export function formatEsbuildError(err: unknown): string {
  if (err && typeof err === 'object' && 'errors' in err) {
    const errors = (
      err as { errors: Array<{ text: string; location?: { line: number; column: number } }> }
    ).errors;
    const first = errors[0];
    if (first) {
      const loc = first.location;
      const prefix = loc ? `script:${loc.line}:${loc.column}: ` : '';
      return prefix + first.text;
    }
  }

  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }

  return String(err);
}

/**
 * Lowers modern JavaScript syntax in a user script via esbuild before compartment execution.
 *
 * Transpilation is syntax-only (no bundling). `import` and `require` are not
 * resolved or enabled.
 *
 * @param source - Raw user-authored script source.
 * @returns Transpiled script source safe to evaluate in the hc compartment.
 * @throws esbuild transform errors when the source is invalid.
 */
async function transpileUserScript(source: string): Promise<string> {
  const result = await transform(source, {
    loader: 'js',
    target: SCRIPT_TRANSPILE_TARGET,
    sourcefile: 'script.js'
  });
  return result.code;
}

/**
 * Compiles user script source for SES compartment evaluation.
 *
 * Scripts without module syntax use the fast syntax-only transform path.
 * Scripts with `import`/`export` are bundled against {@link ScriptRunInput.snippetModules}
 * first so relative snippet imports resolve before the async IIFE wrap.
 *
 * @param source - Raw user-authored script source.
 * @param snippetModules - Importable snippet sources keyed by filename.
 * @param snippetModuleConflicts - Ambiguous snippet filenames.
 * @returns Transpiled script source safe to evaluate in the hc compartment.
 */
async function compileUserScript(
  source: string,
  snippetModules: Record<string, string>,
  snippetModuleConflicts: string[]
): Promise<string> {
  let executableSource = source;

  if (scriptUsesModuleSyntax(source)) {
    executableSource = await bundleUserScript(source, snippetModules, snippetModuleConflicts);
  }

  const wrappedSource = wrapScriptForAsyncEvaluation(executableSource);
  return transpileUserScript(wrappedSource);
}

/**
 * Wraps user script source in an async IIFE so await hc.sendRequest works in the sandbox.
 *
 * @param source - Raw user-authored script source.
 * @returns Source wrapped for async compartment evaluation.
 */
function wrapScriptForAsyncEvaluation(source: string): string {
  return `(async () => {\n${source}\n})()`;
}

/**
 * Runs a pre/post script inside a SES Compartment with the hc API.
 *
 * User source is transpiled with esbuild before execution so modern JavaScript
 * syntax is supported. The compartment receives hc and console globals built by
 * {@link createScriptApi}; Node globals such as `require` and `process` are
 * intentionally not passed through. Callers in production should run this inside
 * a locked-down utilityProcess; unit tests call it directly without `lockdown()`.
 *
 * @param input - Script source, phase, request/response context, and variables.
 * @param options - Optional runtime hooks such as hc.sendRequest transport.
 * @returns Mutated request, variable sets, tests, and logs from the sandbox.
 */
export async function evaluateScript(
  input: ScriptRunInput,
  options?: ScriptApiOptions
): Promise<ScriptRunResult> {
  const passthrough = buildScriptPassthrough(input);

  if (!input.script.trim()) {
    return passthrough;
  }

  let compiledScript: string;
  try {
    compiledScript = await compileUserScript(
      input.script,
      input.snippetModules ?? {},
      input.snippetModuleConflicts ?? []
    );
  } catch (err) {
    return {
      ...passthrough,
      error: sanitizeScriptErrorMessage(formatEsbuildError(err))
    };
  }

  try {
    const api = createScriptApi(input, options);
    const compartment = new Compartment({
      globals: {
        hc: api.hc,
        console: api.console,
        Date,
        Math
      },
      __options__: true
    });
    await compartment.evaluate(compiledScript);
    return api.readResult();
  } catch (err) {
    const rawMessage =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);
    return {
      ...passthrough,
      error: sanitizeScriptErrorMessage(rawMessage)
    };
  }
}
