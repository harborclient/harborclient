import { SourceMap } from 'node:module';

/**
 * One esbuild-generated source map in the compile chain (bundle and/or transpile).
 *
 * Maps are applied from generated (evaluated) code back toward user-authored sources.
 */
export interface ScriptCompileMap {
  /**
   * Parsed VLQ source map for one compile step.
   */
  map: SourceMap;

  /**
   * When true, original coordinates from this map land in the async-IIFE-wrapped
   * buffer and must be adjusted by {@link SCRIPT_ASYNC_IIFE_LINE_OFFSET} before
   * the next map (or before treating them as user lines for non-bundled scripts).
   */
  unwrapAsyncIife?: boolean;
}

/**
 * Original source location after mapping a generated stack frame.
 *
 * Line and column are 1-based for UI display. Locations refer to the compiled
 * input (post variable substitution), which can differ from the editor buffer
 * when multi-line `{{var}}` expansions shift lines.
 */
export interface ScriptOriginalLocation {
  /**
   * Original file path from the sourcemap (`script.js`, snippet filename, etc.).
   */
  source: string;

  /**
   * 1-based line in the original source.
   */
  line: number;

  /**
   * 1-based column in the original source.
   */
  column: number;
}

/**
 * Lines prepended by {@link wrapScriptForAsyncEvaluation} before the user body.
 */
export const SCRIPT_ASYNC_IIFE_LINE_OFFSET = 1;

/**
 * Matches V8 SES/vm frames that point into compartment-evaluated script text.
 */
const ANONYMOUS_FRAME_RE = /<anonymous>:(\d+):(\d+)/;

/**
 * Parses an esbuild source map JSON string into a Node {@link SourceMap}.
 *
 * @param mapJson - Raw source map JSON from esbuild `transform` or `build`.
 * @returns Consumer used to remap generated line/column pairs.
 * @throws When the JSON is not a valid source map object.
 */
export function parseScriptSourceMap(mapJson: string): SourceMap {
  return new SourceMap(JSON.parse(mapJson) as ConstructorParameters<typeof SourceMap>[0]);
}

/**
 * Extracts the first evaluated-script frame from an Error stack.
 *
 * Prefers `<anonymous>:line:col` frames produced by SES / vm evaluation and
 * ignores host frames (Chai, Node internals).
 *
 * @param stack - Raw `Error.stack` string, or undefined when missing.
 * @returns 1-based generated line/column, or null when no script frame exists.
 */
export function parseAnonymousStackFrame(
  stack: string | undefined
): { line: number; column: number } | null {
  if (!stack) {
    return null;
  }

  const match = ANONYMOUS_FRAME_RE.exec(stack);
  if (!match) {
    return null;
  }

  const line = Number(match[1]);
  const column = Number(match[2]);
  if (!Number.isFinite(line) || !Number.isFinite(column) || line < 1 || column < 1) {
    return null;
  }

  return { line, column };
}

/**
 * Normalizes sourcemap source paths for display and navigation.
 *
 * Strips esbuild namespace prefixes and maps the virtual entry module to
 * `script.js` so UI labels match the non-bundled transform sourcefile.
 *
 * @param source - Raw `originalSource` from a SourceMap entry.
 * @returns Clean display path such as `script.js` or `helpers.js`.
 */
export function normalizeScriptMapSource(source: string): string {
  let normalized = source.trim();
  const namespaceSep = normalized.indexOf(':');
  if (namespaceSep > 0 && !normalized.includes('://') && !/^[A-Za-z]:[\\/]/.test(normalized)) {
    // esbuild plugin namespaces appear as `hc-entry:/__entry__.js` or `e:/__entry__.js`.
    const after = normalized.slice(namespaceSep + 1);
    if (after.startsWith('/') || after.startsWith('__')) {
      normalized = after;
    }
  }

  normalized = normalized.replace(/^\//, '');
  if (
    normalized === '__entry__.js' ||
    normalized.endsWith('/__entry__.js') ||
    normalized === 'script.js'
  ) {
    return 'script.js';
  }

  return normalized;
}

/**
 * Reads original coordinates from a SourceMap.findEntry result when present.
 *
 * Node's findEntry return type includes an empty object for unmapped positions,
 * so this helper narrows to usable original source/line/column values.
 *
 * @param entry - Result from {@link SourceMap.findEntry}.
 * @returns Original coordinates, or null when the entry is unmapped.
 */
function readMappedSourceEntry(
  entry: ReturnType<SourceMap['findEntry']>
): { originalSource: string; originalLine: number; originalColumn: number } | null {
  if (entry == null || typeof entry !== 'object') {
    return null;
  }
  const candidate = entry as {
    originalSource?: unknown;
    originalLine?: unknown;
    originalColumn?: unknown;
  };
  if (
    typeof candidate.originalSource !== 'string' ||
    typeof candidate.originalLine !== 'number' ||
    typeof candidate.originalColumn !== 'number'
  ) {
    return null;
  }
  return {
    originalSource: candidate.originalSource,
    originalLine: candidate.originalLine,
    originalColumn: candidate.originalColumn
  };
}

/**
 * Maps a generated (evaluated) line/column through a compile sourcemap chain.
 *
 * @param maps - Ordered maps from outermost (transpile) to innermost (bundle).
 * @param generatedLine - 1-based line in the evaluated script.
 * @param generatedColumn - 1-based column in the evaluated script.
 * @returns Original location when mapping succeeds; null when maps are empty or
 *   the frame does not resolve to an original source.
 */
export function mapGeneratedToOriginal(
  maps: ScriptCompileMap[],
  generatedLine: number,
  generatedColumn: number
): ScriptOriginalLocation | null {
  if (maps.length === 0) {
    return null;
  }

  let line0 = generatedLine - 1;
  let column0 = generatedColumn - 1;
  let source = 'script.js';
  let resolved = false;

  for (const step of maps) {
    const entry = readMappedSourceEntry(step.map.findEntry(line0, column0));
    if (!entry) {
      return resolved
        ? {
            source: normalizeScriptMapSource(source),
            line: line0 + 1,
            column: column0 + 1
          }
        : null;
    }

    source = entry.originalSource;
    line0 = entry.originalLine;
    column0 = entry.originalColumn;
    resolved = true;

    if (step.unwrapAsyncIife) {
      line0 -= SCRIPT_ASYNC_IIFE_LINE_OFFSET;
      if (line0 < 0) {
        return null;
      }
    }
  }

  if (!resolved) {
    return null;
  }

  return {
    source: normalizeScriptMapSource(source),
    line: line0 + 1,
    column: column0 + 1
  };
}

/**
 * Resolves an Error stack to an original user/snippet location via compile maps.
 *
 * @param stack - Raw error stack from the sandbox.
 * @param maps - Compile sourcemap chain for this script run.
 * @returns Mapped location, or null when the stack cannot be remapped.
 */
export function resolveStackToOriginalLocation(
  stack: string | undefined,
  maps: ScriptCompileMap[]
): ScriptOriginalLocation | null {
  const frame = parseAnonymousStackFrame(stack);
  if (!frame) {
    return null;
  }

  return mapGeneratedToOriginal(maps, frame.line, frame.column);
}

/**
 * Builds a single-line error message that includes a mapped script location.
 *
 * @param message - Human-readable error text (already first-line / sanitized as needed).
 * @param location - Mapped original location, if known.
 * @returns Message prefixed with `source:line:column:` when location is present.
 */
export function formatLocatedScriptError(
  message: string,
  location: ScriptOriginalLocation | null | undefined
): string {
  const trimmed = message.trim();
  if (!location) {
    return trimmed;
  }

  return `${location.source}:${location.line}:${location.column}: ${trimmed}`;
}

/**
 * Matches the `source:line:column: ` prefix produced by {@link formatLocatedScriptError}.
 */
const LOCATED_ERROR_PREFIX_RE = /^[^:\s][^:\n]*:\d+:\d+:\s+/;

/**
 * Removes the `source:line:column:` prefix added by {@link formatLocatedScriptError}.
 *
 * Used where the location is already conveyed by context (for example the
 * CodeMirror error underline) and repeating it in the message is noise.
 *
 * @param message - Located or plain single-line script error text.
 * @returns The message without its location prefix, trimmed.
 */
export function stripLocatedScriptErrorPrefix(message: string): string {
  return message.trim().replace(LOCATED_ERROR_PREFIX_RE, '');
}
