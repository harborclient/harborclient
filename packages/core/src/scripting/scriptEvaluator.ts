import 'ses';
import { transform } from 'esbuild';
import type { ScriptErrorLocation, ScriptRunInput, ScriptRunResult } from '../types';
import { normalizeAuth } from '../auth';
import { createScriptApi, type ScriptApiOptions } from './scriptApi';
import { bundleUserScript, scriptUsesModuleSyntax } from './scriptSnippetBundler';
import {
  SCRIPT_ASYNC_IIFE_LINE_OFFSET,
  formatLocatedScriptError,
  normalizeScriptMapSource,
  parseScriptSourceMap,
  resolveStackToOriginalLocation,
  type ScriptCompileMap
} from './scriptSourceMap';

/** esbuild target for lowering modern user script syntax before compartment execution. */
const SCRIPT_TRANSPILE_TARGET = 'es2020';

/**
 * Compiled user script ready for SES evaluation, plus sourcemaps for stack remap.
 */
export interface CompiledUserScript {
  /**
   * Transpiled JavaScript evaluated inside the compartment (no sourceMappingURL).
   */
  code: string;

  /**
   * Sourcemap chain from evaluated code back toward user/snippet sources.
   * Ordered outermost-first (transpile, then optional bundle).
   */
  maps: ScriptCompileMap[];
}

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
 * Tip appended to top-level assertion / expect-related script errors.
 */
const TOP_LEVEL_ASSERTION_HINT =
  'Tip: wrap assertions in hc.test("name", () => { ... }) so failures appear as named test results and do not abort the script. Both .to.be.ok and .to.be.ok() are valid.';

/**
 * Returns whether a sanitized script error looks like a top-level Chai/expect failure.
 *
 * @param message - Sanitized single-line script error.
 * @returns True when the message should receive the hc.test wrap tip.
 */
export function isTopLevelAssertionErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /expected .+ to (be|equal|eql|include|have)/i.test(message) ||
    lower.includes('is not a function') ||
    lower.includes('hc.expect') ||
    /\.to\.be\.ok/.test(lower)
  );
}

/**
 * Appends an actionable hc.test tip to top-level assertion failures.
 *
 * Top-level \`hc.expect(...)\` failures abort the script instead of recording a
 * Tests tab row. The tip steers users toward wrapping assertions in \`hc.test\`.
 *
 * @param message - Sanitized single-line script error.
 * @returns Message with tip appended when it looks like an assertion failure.
 */
export function enrichTopLevelAssertionErrorMessage(message: string): string {
  if (!message || message.includes('Tip: wrap assertions in hc.test')) {
    return message;
  }
  if (!isTopLevelAssertionErrorMessage(message)) {
    return message;
  }
  return `${message} ${TOP_LEVEL_ASSERTION_HINT}`;
}

/**
 * Reads the first message from an esbuild transform/build failure, when present.
 *
 * @param err - Thrown esbuild error or unknown value.
 * @returns Error text and optional raw location, or null for non-esbuild errors.
 */
function readFirstEsbuildMessage(err: unknown): {
  text: string;
  location?: { file?: string; line: number; column: number } | null;
} | null {
  if (err && typeof err === 'object' && 'errors' in err) {
    const errors = (
      err as {
        errors: Array<{
          text: string;
          location?: { file?: string; line: number; column: number } | null;
        }>;
      }
    ).errors;
    const first = errors[0];
    if (first) {
      return first;
    }
  }

  return null;
}

/**
 * Formats an esbuild transform failure into a single-line message for the UI.
 *
 * @param err - Thrown esbuild error or unknown value.
 * @returns Human-readable compile error text, optionally with line/column.
 */
export function formatEsbuildError(err: unknown): string {
  const first = readFirstEsbuildMessage(err);
  if (first) {
    const loc = first.location;
    const prefix = loc ? `script:${loc.line}:${loc.column}: ` : '';
    return prefix + first.text;
  }

  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }

  return String(err);
}

/**
 * Maps an esbuild error location onto user/snippet source coordinates.
 *
 * esbuild lines are 1-based and columns 0-based; the returned location follows
 * the 1-based convention used by runtime stack remapping. Locations that fall
 * inside host framing (the async-IIFE prelude or the synthetic bundle entry)
 * are dropped rather than misattributed.
 *
 * @param err - Thrown esbuild error or unknown value.
 * @param lineOffset - Lines prepended to the failing buffer before the user
 *   source (async-IIFE wrap), subtracted from the reported line.
 * @returns Mapped location, or null when the error carries no usable location.
 */
function extractEsbuildErrorLocation(err: unknown, lineOffset: number): ScriptErrorLocation | null {
  const loc = readFirstEsbuildMessage(err)?.location;
  if (!loc || !Number.isFinite(loc.line) || !Number.isFinite(loc.column)) {
    return null;
  }

  const line = loc.line - lineOffset;
  if (line < 1) {
    return null;
  }

  const source = normalizeScriptMapSource(loc.file || 'script.js');
  if (source === 'script-entry.js') {
    return null;
  }

  return { source, line, column: loc.column + 1 };
}

/**
 * Compile failure carrying an optional mapped user-source location.
 *
 * Thrown by {@link compileUserScript} so {@link evaluateScript} can surface
 * structured line/column data alongside the sanitized message.
 */
class ScriptCompileError extends Error {
  /**
   * Mapped location in user or snippet source, when esbuild reported one.
   */
  readonly location: ScriptErrorLocation | null;

  constructor(message: string, location: ScriptErrorLocation | null) {
    super(message);
    this.name = 'ScriptCompileError';
    this.location = location;
  }
}

/**
 * Converts an esbuild failure into a {@link ScriptCompileError}.
 *
 * @param err - Thrown esbuild error or unknown value.
 * @param lineOffset - Async-IIFE line offset for the failing buffer, or null
 *   when the buffer does not correspond to user source (bundled output).
 * @returns Compile error with a located message when mapping succeeded.
 */
function toScriptCompileError(err: unknown, lineOffset: number | null): ScriptCompileError {
  const location = lineOffset == null ? null : extractEsbuildErrorLocation(err, lineOffset);
  if (location) {
    const text = readFirstEsbuildMessage(err)?.text ?? formatEsbuildError(err);
    return new ScriptCompileError(formatLocatedScriptError(text, location), location);
  }

  return new ScriptCompileError(formatEsbuildError(err), null);
}

/**
 * Lowers modern JavaScript syntax in a user script via esbuild before compartment execution.
 *
 * Transpilation is syntax-only (no bundling). `import` and `require` are not
 * resolved or enabled. A sourcemap is returned so runtime stacks can be remapped
 * to the wrap/transpile input (and then to user source via the IIFE offset).
 *
 * @param source - Source to transpile (typically the async-IIFE-wrapped script).
 * @returns Transpiled code and sourcemap JSON string.
 * @throws esbuild transform errors when the source is invalid.
 */
async function transpileUserScript(source: string): Promise<{ code: string; mapJson: string }> {
  const result = await transform(source, {
    loader: 'js',
    target: SCRIPT_TRANSPILE_TARGET,
    sourcefile: 'script.js',
    sourcemap: true
  });
  return {
    code: result.code,
    mapJson: result.map
  };
}

/**
 * Compiles user script source for SES compartment evaluation.
 *
 * Scripts without module syntax use the fast syntax-only transform path.
 * Scripts with `import`/`export` are bundled against {@link ScriptRunInput.snippetModules}
 * first so relative snippet imports resolve before the async IIFE wrap.
 *
 * Locations from runtime stacks are remapped through the returned sourcemap chain.
 * Mapped lines refer to the compile input (after any host variable substitution),
 * which can differ from the editor buffer when multi-line expansions shift lines.
 *
 * @param source - Raw user-authored script source.
 * @param snippetModules - Importable snippet sources keyed by filename.
 * @param snippetModuleConflicts - Ambiguous snippet filenames.
 * @returns Transpiled code and sourcemap chain for stack remapping.
 */
async function compileUserScript(
  source: string,
  snippetModules: Record<string, string>,
  snippetModuleConflicts: string[]
): Promise<CompiledUserScript> {
  let executableSource = source;
  let bundleMapJson: string | undefined;
  const bundled = scriptUsesModuleSyntax(source);

  if (bundled) {
    try {
      const bundleResult = await bundleUserScript(source, snippetModules, snippetModuleConflicts);
      executableSource = bundleResult.code;
      bundleMapJson = bundleResult.mapJson;
    } catch (err) {
      // Bundle-step errors point directly at user or snippet source (pre-wrap).
      throw toScriptCompileError(err, 0);
    }
  }

  const wrappedSource = wrapScriptForAsyncEvaluation(executableSource);
  let transpiled: { code: string; mapJson: string };
  try {
    transpiled = await transpileUserScript(wrappedSource);
  } catch (err) {
    // Transpile locations land in the async-IIFE-wrapped buffer. After bundling
    // those lines no longer correspond to user source, so only the non-bundled
    // path can attribute a location.
    throw toScriptCompileError(err, bundled ? null : SCRIPT_ASYNC_IIFE_LINE_OFFSET);
  }

  const maps: ScriptCompileMap[] = [
    {
      map: parseScriptSourceMap(transpiled.mapJson),
      // Transpile originals are in the async-IIFE-wrapped buffer.
      unwrapAsyncIife: true
    }
  ];

  if (bundleMapJson) {
    maps.push({
      map: parseScriptSourceMap(bundleMapJson)
    });
  }

  return {
    code: transpiled.code,
    maps
  };
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
 * Reads a thrown value's message and optional stack for location mapping.
 *
 * @param err - Unknown thrown value from compartment evaluation.
 * @returns Message and stack when present on an Error-like object.
 */
function readThrownError(err: unknown): { message: string; stack?: string } {
  if (err && typeof err === 'object') {
    const message = 'message' in err ? String((err as { message: unknown }).message) : String(err);
    const stack =
      'stack' in err && typeof (err as { stack: unknown }).stack === 'string'
        ? (err as { stack: string }).stack
        : undefined;
    return { message, stack };
  }

  return { message: String(err) };
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

  let compiled: CompiledUserScript;
  try {
    compiled = await compileUserScript(
      input.script,
      input.snippetModules ?? {},
      input.snippetModuleConflicts ?? []
    );
  } catch (err) {
    const compileError = err instanceof ScriptCompileError ? err : null;
    return {
      ...passthrough,
      error: sanitizeScriptErrorMessage(compileError?.message ?? formatEsbuildError(err)),
      ...(compileError?.location ? { errorLocation: compileError.location } : {})
    };
  }

  try {
    const api = createScriptApi(input, { ...options, compileMaps: compiled.maps });
    const compartment = new Compartment({
      globals: {
        hc: api.hc,
        console: api.console,
        Date,
        Math
      },
      __options__: true
    });
    await compartment.evaluate(compiled.code);
    return api.readResult();
  } catch (err) {
    const thrown = readThrownError(err);
    const location = resolveStackToOriginalLocation(thrown.stack, compiled.maps);
    const located = formatLocatedScriptError(thrown.message, location);
    return {
      ...passthrough,
      error: enrichTopLevelAssertionErrorMessage(sanitizeScriptErrorMessage(located)),
      ...(location ? { errorLocation: location } : {})
    };
  }
}
