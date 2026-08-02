import type { ScriptPhase } from '@harborclient/sdk';
import type {
  ScriptConsoleMethod,
  ScriptConsoleTableData,
  ScriptLogEntry,
  ScriptLogLevel,
  ScriptLogLine,
  ScriptTestScope
} from '../types/script';

/**
 * Script identity used when enriching sandbox log lines with host metadata.
 */
export interface ScriptLogOwner {
  /**
   * Display label of the script slot.
   */
  label: string;
  /**
   * Stable script id when the slot has one.
   */
  scriptId?: string;
  /**
   * Pre or post phase of the slot.
   */
  phase: ScriptPhase;
  /**
   * Collection / folder / request ownership of the slot.
   */
  scope?: ScriptTestScope;
}

const SCRIPT_CONSOLE_METHODS = new Set<ScriptConsoleMethod>([
  'log',
  'error',
  'warn',
  'debug',
  'assert',
  'group',
  'groupCollapsed',
  'table',
  'time',
  'timeEnd',
  'timeLog',
  'trace'
]);

/**
 * Derives a console method from a legacy level when `method` is missing.
 *
 * @param level - Coerced log level.
 * @returns Method matching the level for older stored rows.
 */
function methodFromLevel(level: ScriptLogLevel): ScriptConsoleMethod {
  if (level === 'error') {
    return 'error';
  }
  if (level === 'warn') {
    return 'warn';
  }
  return 'log';
}

/**
 * Normalizes a candidate log level to {@link ScriptLogLevel}.
 *
 * @param value - Raw level from storage or a legacy `[error]` prefix.
 * @returns Canonical level (`error`, `warn`, or default `log`).
 */
function coerceScriptLogLevel(value: unknown): ScriptLogLevel {
  if (value === 'error') {
    return 'error';
  }
  if (value === 'warn') {
    return 'warn';
  }
  return 'log';
}

/**
 * Normalizes a candidate console method, falling back from level when omitted.
 *
 * @param value - Raw method from storage.
 * @param level - Coerced level used when method is missing or unknown.
 * @returns Canonical {@link ScriptConsoleMethod}.
 */
function coerceScriptConsoleMethod(value: unknown, level: ScriptLogLevel): ScriptConsoleMethod {
  if (typeof value === 'string' && SCRIPT_CONSOLE_METHODS.has(value as ScriptConsoleMethod)) {
    return value as ScriptConsoleMethod;
  }
  return methodFromLevel(level);
}

/**
 * Returns whether a value looks like structured console.table data.
 *
 * @param value - Candidate table payload.
 */
function isScriptConsoleTableData(value: unknown): value is ScriptConsoleTableData {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const raw = value as { columns?: unknown; rows?: unknown };
  if (!Array.isArray(raw.columns) || !Array.isArray(raw.rows)) {
    return false;
  }
  if (!raw.columns.every((col) => typeof col === 'string')) {
    return false;
  }
  return raw.rows.every(
    (row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string')
  );
}

/**
 * Attaches script ownership metadata to sandbox console lines.
 *
 * @param lines - Lines captured inside the sandbox for one script run.
 * @param script - Slot that produced those lines.
 * @returns Host-enriched log entries for the response Logs tab / console history.
 */
export function enrichScriptLogLines(
  lines: readonly ScriptLogLine[],
  script: ScriptLogOwner
): ScriptLogEntry[] {
  return lines.map((line) => ({
    message: line.message,
    level: line.level,
    method: line.method,
    ...(line.table != null ? { table: line.table } : {}),
    scriptName: script.label,
    ...(script.scriptId != null && script.scriptId.length > 0 ? { scriptId: script.scriptId } : {}),
    phase: script.phase,
    ...(script.scope != null ? { scope: script.scope } : {})
  }));
}

/**
 * Returns whether a value looks like a structured script log entry.
 *
 * @param value - Candidate array element from storage or IPC.
 */
function isScriptLogEntryLike(value: unknown): value is {
  message: string;
  level?: unknown;
  method?: unknown;
  table?: unknown;
  scriptName?: unknown;
  scriptId?: unknown;
  phase?: unknown;
  scope?: unknown;
} {
  return (
    typeof value === 'object' &&
    value != null &&
    !Array.isArray(value) &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

/**
 * Coerces legacy `string[]` script logs and structured entries into {@link ScriptLogEntry} rows.
 *
 * Legacy labeled aggregates used a bare `[Script label]` separator line before that
 * script's messages. Those separators become `scriptName` on following string lines.
 *
 * @param raw - Value from tab state, workflow history, or an older export.
 * @returns Normalized log entries (empty when `raw` is not an array).
 */
export function coerceScriptLogs(raw: unknown): ScriptLogEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const entries: ScriptLogEntry[] = [];
  let currentScriptName = 'Script';

  for (const item of raw) {
    if (typeof item === 'string') {
      const trimmed = item;
      const labelMatch = /^\[([^\]]+)\]$/.exec(trimmed);
      if (labelMatch && !trimmed.includes('\n')) {
        currentScriptName = labelMatch[1] ?? currentScriptName;
        continue;
      }

      const isError = trimmed.startsWith('[error] ');
      const level: ScriptLogLevel = isError ? 'error' : 'log';
      entries.push({
        message: isError ? trimmed.slice('[error] '.length) : trimmed,
        level,
        method: methodFromLevel(level),
        scriptName: currentScriptName
      });
      continue;
    }

    if (isScriptLogEntryLike(item)) {
      const scriptName =
        typeof item.scriptName === 'string' && item.scriptName.trim().length > 0
          ? item.scriptName
          : currentScriptName;
      currentScriptName = scriptName;
      const level = coerceScriptLogLevel(item.level);
      const method = coerceScriptConsoleMethod(item.method, level);
      entries.push({
        message: item.message,
        level,
        method,
        ...(isScriptConsoleTableData(item.table) ? { table: item.table } : {}),
        scriptName,
        ...(typeof item.scriptId === 'string' && item.scriptId.length > 0
          ? { scriptId: item.scriptId }
          : {}),
        ...(item.phase === 'pre' || item.phase === 'post' ? { phase: item.phase } : {}),
        ...(item.scope === 'collection' ||
        item.scope === 'folder' ||
        item.scope === 'request' ||
        item.scope === 'plugin'
          ? { scope: item.scope }
          : {})
      });
    }
  }

  return entries;
}

/**
 * Flattens structured log entries to plain strings for export / filestore schemas.
 *
 * Groups by script label with a `[label]` separator so older consumers remain readable.
 *
 * @param entries - Structured log rows.
 * @returns Legacy-style string lines.
 */
export function flattenScriptLogs(entries: readonly ScriptLogEntry[]): string[] {
  const out: string[] = [];
  let lastLabel: string | undefined;

  for (const entry of entries) {
    if (entry.scriptName !== lastLabel) {
      out.push(`[${entry.scriptName}]`);
      lastLabel = entry.scriptName;
    }
    out.push(entry.level === 'error' ? `[error] ${entry.message}` : entry.message);
  }

  return out;
}

/**
 * Joins structured log entry messages for single-string export dumps.
 *
 * @param entries - Structured log rows.
 * @returns Newline-joined message text (error lines keep an `[error]` prefix).
 */
export function joinScriptLogMessages(entries: readonly ScriptLogEntry[]): string {
  return entries
    .map((entry) => (entry.level === 'error' ? `[error] ${entry.message}` : entry.message))
    .join('\n');
}
