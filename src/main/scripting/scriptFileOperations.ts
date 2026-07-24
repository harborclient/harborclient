import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, join, sep } from 'path';
import { homedir } from 'os';
import { dump as yamlDump, load as yamlLoad } from 'js-yaml';
import Papa from 'papaparse';
import { normalizePath, resolveRealPath } from '#/main/plugins/pluginFsAllowlist';
import { getGeneralSettings } from '#/main/settings/generalSettings';
import { listStorageConnections } from '#/main/settings/storageSettings';
import type { GitSettings } from '#/shared/types';

/**
 * Maximum bytes a script may read or write in a single file operation.
 */
export const SCRIPT_FILE_MAX_BYTES = 50 * 1024 * 1024;

/**
 * File / codec operations bridged from the script sandbox to the main process.
 */
export type ScriptFileOp =
  | 'readText'
  | 'readBytes'
  | 'writeText'
  | 'writeBytes'
  | 'append'
  | 'exists'
  | 'stat'
  | 'readJson'
  | 'readYaml'
  | 'readCsv'
  | 'writeJson'
  | 'writeYaml'
  | 'writeCsv'
  | 'parseYaml'
  | 'parseCsv'
  | 'stringifyYaml'
  | 'stringifyCsv';

/**
 * Access level required for a script file operation.
 */
export type ScriptFileAccess = 'none' | 'read' | 'write';

/**
 * CSV parse/stringify options exposed to scripts.
 */
export interface ScriptCsvOptions {
  /**
   * Parse: when true (default), the first row becomes object keys.
   * Write: optional column order as a string array; when omitted, keys are inferred.
   */
  headers?: boolean | string[];
  /**
   * Field delimiter (default `,`).
   */
  delimiter?: string;
  /**
   * When true, empty lines are skipped during parse.
   */
  skipEmpty?: boolean;
}

/**
 * JSON write formatting options exposed to scripts.
 */
export interface ScriptJsonWriteOptions {
  /**
   * When true, pretty-print with indentation (default true).
   */
  pretty?: boolean;
  /**
   * Indent width when pretty is true (default 2).
   */
  indent?: number;
}

/**
 * File metadata returned by hc.fs.stat.
 */
export interface ScriptFileStat {
  size: number;
  mtimeMs: number;
  isFile: boolean;
  isDirectory: boolean;
}

/**
 * Payload for a bridged script file / codec call.
 */
export interface ScriptFileRequest {
  op: ScriptFileOp;
  /**
   * Relative or absolute path for filesystem ops.
   */
  path?: string;
  /**
   * UTF-8 text for write/append or codec input.
   */
  contents?: string;
  /**
   * Binary payload for writeBytes.
   */
  bytes?: Uint8Array;
  /**
   * Structured value for typed write / stringify.
   */
  value?: unknown;
  /**
   * CSV or JSON write options.
   */
  options?: ScriptCsvOptions | ScriptJsonWriteOptions;
}

/**
 * Context used to resolve the effective script file root.
 */
export interface ScriptFileRootContext {
  /**
   * Storage connection id for the active collection, when known.
   */
  connectionId?: string | null;
}

/**
 * Returns the access level required for a file bridge operation.
 *
 * @param op - Bridged operation name.
 * @returns Access level used by the host gate.
 */
export function scriptFileAccessForOp(op: ScriptFileOp): ScriptFileAccess {
  switch (op) {
    case 'parseYaml':
    case 'parseCsv':
    case 'stringifyYaml':
    case 'stringifyCsv':
      return 'none';
    case 'writeText':
    case 'writeBytes':
    case 'append':
    case 'writeJson':
    case 'writeYaml':
    case 'writeCsv':
      return 'write';
    default:
      return 'read';
  }
}

/**
 * Resolves the effective root directory that confines script filesystem access.
 *
 * Git-backed collections use their repository directory. Otherwise the
 * configured scriptFileRoot is used, falling back to the user home directory.
 *
 * @param context - Optional collection connection used to detect git roots.
 * @returns Absolute root directory path.
 */
export function resolveScriptFileRoot(context?: ScriptFileRootContext): string {
  const connectionId = context?.connectionId?.trim();
  if (connectionId) {
    const connection = listStorageConnections().find((entry) => entry.id === connectionId);
    if (connection?.type === 'git') {
      const settings = connection.settings as GitSettings;
      const repoPath = typeof settings.repoPath === 'string' ? settings.repoPath.trim() : '';
      if (repoPath) {
        return normalizePath(repoPath);
      }
    }
  }

  const configured = getGeneralSettings().scriptFileRoot.trim();
  if (configured) {
    return normalizePath(configured);
  }
  return normalizePath(homedir());
}

/**
 * Resolves a script-supplied path under the effective root and rejects escapes.
 *
 * @param root - Absolute confinement root.
 * @param targetPath - Relative or absolute path from the script.
 * @returns Canonical absolute path under the root.
 * @throws When the path escapes the root or contains parent segments.
 */
export function resolveScriptFilePath(root: string, targetPath: string): string {
  const trimmed = String(targetPath ?? '').trim();
  if (!trimmed) {
    throw new Error('hc.fs requires a path');
  }

  const rootReal = resolveRealPath(root);
  const candidate = isAbsolute(trimmed) ? trimmed : join(root, trimmed);
  const resolved = resolveRealPath(candidate);
  const prefix = rootReal.endsWith(sep) ? rootReal : `${rootReal}${sep}`;
  if (resolved !== rootReal && !resolved.startsWith(prefix)) {
    throw new Error(`Path is outside the script file root: ${trimmed}`);
  }
  return resolved;
}

/**
 * Asserts a byte length does not exceed the script file size limit.
 *
 * @param byteLength - Number of bytes about to be read or written.
 * @throws When the payload exceeds {@link SCRIPT_FILE_MAX_BYTES}.
 */
function assertWithinSizeLimit(byteLength: number): void {
  if (byteLength > SCRIPT_FILE_MAX_BYTES) {
    throw new Error(
      `Script file exceeds the ${SCRIPT_FILE_MAX_BYTES} byte limit (${byteLength} bytes)`
    );
  }
}

/**
 * Ensures the parent directory of a write target exists.
 *
 * @param filePath - Absolute file path about to be written.
 */
function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

/**
 * Parses CSV text with PapaParse using script-facing options.
 *
 * @param text - Raw CSV text.
 * @param options - Optional parse options.
 * @returns Object rows when headers are enabled, otherwise string[][].
 */
export function parseCsvText(text: string, options?: ScriptCsvOptions): unknown {
  const headers = options?.headers !== false && !Array.isArray(options?.headers);
  const delimiter = typeof options?.delimiter === 'string' ? options.delimiter : ',';
  const skipEmpty = options?.skipEmpty !== false;
  const parsed = Papa.parse<string[] | Record<string, string>>(text, {
    header: headers,
    delimiter,
    skipEmptyLines: skipEmpty,
    dynamicTyping: false
  });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw new Error(`CSV parse error: ${first.message}`);
  }
  return parsed.data;
}

/**
 * Serializes rows to CSV text with PapaParse.
 *
 * @param rows - Object rows or string[][].
 * @param options - Optional stringify options.
 * @returns CSV text.
 */
export function stringifyCsvText(rows: unknown, options?: ScriptCsvOptions): string {
  if (!Array.isArray(rows)) {
    throw new Error('hc.fs.writeCsv / hc.stringify.csv requires an array of rows');
  }
  const delimiter = typeof options?.delimiter === 'string' ? options.delimiter : ',';
  const columns = Array.isArray(options?.headers) ? options.headers : undefined;
  return Papa.unparse(rows as Parameters<typeof Papa.unparse>[0], {
    delimiter,
    columns,
    header: columns != null || (rows.length > 0 && !Array.isArray(rows[0]))
  });
}

/**
 * Parses YAML text with js-yaml.
 *
 * @param text - Raw YAML text.
 * @returns Parsed value.
 */
export function parseYamlText(text: string): unknown {
  return yamlLoad(text) ?? null;
}

/**
 * Serializes a value to YAML text.
 *
 * @param value - Value to dump.
 * @returns YAML text.
 */
export function stringifyYamlText(value: unknown): string {
  return yamlDump(value, { lineWidth: -1, noRefs: true });
}

/**
 * Serializes a value to JSON text with optional pretty-printing.
 *
 * @param value - Value to stringify.
 * @param options - Pretty / indent options.
 * @returns JSON text.
 */
export function stringifyJsonText(value: unknown, options?: ScriptJsonWriteOptions): string {
  const pretty = options?.pretty !== false;
  const indent = Number.isInteger(options?.indent) ? Number(options?.indent) : 2;
  return pretty ? `${JSON.stringify(value, null, indent)}\n` : JSON.stringify(value);
}

/**
 * Executes a bridged script file / codec operation under the resolved root.
 *
 * @param request - Operation and payload from the sandbox.
 * @param rootContext - Collection connection used for git root resolution.
 * @returns Operation result (string, Uint8Array, object, boolean, null, or undefined).
 */
export function executeScriptFileRequest(
  request: ScriptFileRequest,
  rootContext?: ScriptFileRootContext
): unknown {
  const op = request.op;
  const access = scriptFileAccessForOp(op);

  if (access === 'none') {
    switch (op) {
      case 'parseYaml':
        return parseYamlText(String(request.contents ?? ''));
      case 'parseCsv':
        return parseCsvText(String(request.contents ?? ''), request.options as ScriptCsvOptions);
      case 'stringifyYaml':
        return stringifyYamlText(request.value);
      case 'stringifyCsv':
        return stringifyCsvText(request.value, request.options as ScriptCsvOptions);
      default:
        throw new Error(`Unsupported script file operation: ${op}`);
    }
  }

  const root = resolveScriptFileRoot(rootContext);
  const filePath = resolveScriptFilePath(root, String(request.path ?? ''));

  switch (op) {
    case 'exists':
      return existsSync(filePath);
    case 'stat': {
      if (!existsSync(filePath)) {
        return null;
      }
      const stats = statSync(filePath);
      const result: ScriptFileStat = {
        size: stats.size,
        mtimeMs: stats.mtimeMs,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
      return result;
    }
    case 'readText':
    case 'readJson':
    case 'readYaml':
    case 'readCsv': {
      const stats = statSync(filePath);
      assertWithinSizeLimit(stats.size);
      const text = readFileSync(filePath, 'utf8');
      if (op === 'readText') {
        return text;
      }
      if (op === 'readJson') {
        return JSON.parse(text) as unknown;
      }
      if (op === 'readYaml') {
        return parseYamlText(text);
      }
      return parseCsvText(text, request.options as ScriptCsvOptions);
    }
    case 'readBytes': {
      const stats = statSync(filePath);
      assertWithinSizeLimit(stats.size);
      return new Uint8Array(readFileSync(filePath));
    }
    case 'writeText':
    case 'append': {
      const contents = String(request.contents ?? '');
      assertWithinSizeLimit(Buffer.byteLength(contents, 'utf8'));
      ensureParentDir(filePath);
      if (op === 'append') {
        appendFileSync(filePath, contents, 'utf8');
      } else {
        writeFileSync(filePath, contents, 'utf8');
      }
      return undefined;
    }
    case 'writeBytes': {
      if (!(request.bytes instanceof Uint8Array)) {
        throw new Error('hc.fs.writeBytes requires a Uint8Array');
      }
      const bytes = request.bytes;
      assertWithinSizeLimit(bytes.byteLength);
      ensureParentDir(filePath);
      writeFileSync(filePath, bytes);
      return undefined;
    }
    case 'writeJson': {
      const text = stringifyJsonText(request.value, request.options as ScriptJsonWriteOptions);
      assertWithinSizeLimit(Buffer.byteLength(text, 'utf8'));
      ensureParentDir(filePath);
      writeFileSync(filePath, text, 'utf8');
      return undefined;
    }
    case 'writeYaml': {
      const text = stringifyYamlText(request.value);
      assertWithinSizeLimit(Buffer.byteLength(text, 'utf8'));
      ensureParentDir(filePath);
      writeFileSync(filePath, text, 'utf8');
      return undefined;
    }
    case 'writeCsv': {
      const text = stringifyCsvText(request.value, request.options as ScriptCsvOptions);
      assertWithinSizeLimit(Buffer.byteLength(text, 'utf8'));
      ensureParentDir(filePath);
      writeFileSync(filePath, text, 'utf8');
      return undefined;
    }
    default:
      throw new Error(`Unsupported script file operation: ${op}`);
  }
}
