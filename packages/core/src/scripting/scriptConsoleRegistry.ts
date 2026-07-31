import type {
  ScriptConsoleComponent,
  ScriptConsoleMethod,
  ScriptLogLevel,
  ScriptLogLine
} from '../types/script';
import {
  buildConsoleTable,
  formatConsoleArgs,
  formatConsoleTable,
  formatConsoleTableData,
  formatConsoleTrace,
  indentConsoleMessage
} from './scriptLogFormat';

/**
 * Capturing console surface exposed inside the script sandbox.
 */
export type ScriptConsole = {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  assert: (condition?: unknown, ...args: unknown[]) => void;
  clear: () => void;
  group: (...label: unknown[]) => void;
  groupCollapsed: (...label: unknown[]) => void;
  groupEnd: () => void;
  table: (data?: unknown, columns?: unknown) => void;
  time: (label?: unknown) => void;
  timeEnd: (label?: unknown) => void;
  timeLog: (label?: unknown, ...args: unknown[]) => void;
  trace: (...args: unknown[]) => void;
};

/**
 * Mutable log buffer and helpers used while building the sandbox console.
 */
export interface ScriptConsoleHost {
  /**
   * Mutable list of captured log lines for the current script run.
   */
  logs: ScriptLogLine[];
}

/**
 * One entry in the console method registry: renderer component id for the method.
 */
export interface ScriptConsoleRegistryEntry {
  /**
   * GUI component id used to render lines produced by this method.
   */
  component: ScriptConsoleComponent;
}

/**
 * Maps each console method that emits a log line to its renderer component id.
 *
 * Capture handlers live in {@link createScriptConsole}; this table is the shared
 * method → component contract for core and the GUI render registry.
 */
export const SCRIPT_CONSOLE_REGISTRY: Record<ScriptConsoleMethod, ScriptConsoleRegistryEntry> = {
  log: { component: 'log' },
  error: { component: 'log' },
  warn: { component: 'log' },
  debug: { component: 'log' },
  assert: { component: 'log' },
  group: { component: 'log' },
  groupCollapsed: { component: 'log' },
  table: { component: 'table' },
  time: { component: 'log' },
  timeEnd: { component: 'log' },
  timeLog: { component: 'log' },
  trace: { component: 'trace' }
};

/**
 * Resolves the renderer component id for a captured console method.
 *
 * @param method - Method stored on a log line.
 * @returns Component id for the GUI render registry.
 */
export function scriptConsoleComponentForMethod(
  method: ScriptConsoleMethod
): ScriptConsoleComponent {
  return SCRIPT_CONSOLE_REGISTRY[method].component;
}

/**
 * Builds the capturing console object for one script run.
 *
 * @param host - Mutable log buffer owned by createScriptApi.
 * @returns Console methods bound to the host buffer (group depth and timers closed over).
 */
export function createScriptConsole(host: ScriptConsoleHost): ScriptConsole {
  /**
   * Current console.group nesting depth; messages are indented by this amount.
   */
  let groupDepth = 0;

  /**
   * Active console.time labels mapped to start timestamps (Date.now()).
   */
  const timers = new Map<string, number>();

  /**
   * Appends one captured console line, applying the current group indent to the message.
   *
   * @param level - Display severity.
   * @param method - Console API method that produced the line.
   * @param message - Formatted message text before indentation.
   * @param extra - Optional structured fields (for example table payload).
   */
  const pushLog = (
    level: ScriptLogLevel,
    method: ScriptConsoleMethod,
    message: string,
    extra?: Pick<ScriptLogLine, 'table'>
  ): void => {
    host.logs.push({
      message: indentConsoleMessage(message, groupDepth),
      level,
      method,
      ...(extra?.table != null ? { table: extra.table } : {})
    });
  };

  /**
   * Resolves a console.time label, defaulting to `"default"` like browsers.
   *
   * @param label - Optional timer name from the script.
   * @returns Normalized timer label string.
   */
  const timerLabel = (label?: unknown): string =>
    label === undefined || label === null ? 'default' : String(label);

  /**
   * Emits a console.group / groupCollapsed label (if any) then increases depth.
   *
   * @param method - group or groupCollapsed.
   * @param labelArgs - Optional group label arguments.
   */
  const beginGroup = (method: 'group' | 'groupCollapsed', ...labelArgs: unknown[]): void => {
    if (labelArgs.length > 0) {
      pushLog('log', method, formatConsoleArgs(labelArgs));
    }
    groupDepth += 1;
  };

  return {
    log: (...args: unknown[]) => {
      pushLog('log', 'log', formatConsoleArgs(args));
    },
    error: (...args: unknown[]) => {
      pushLog('error', 'error', formatConsoleArgs(args));
    },
    warn: (...args: unknown[]) => {
      pushLog('warn', 'warn', formatConsoleArgs(args));
    },
    debug: (...args: unknown[]) => {
      pushLog('log', 'debug', formatConsoleArgs(args));
    },
    /**
     * Logs an error when `condition` is falsy (browser-compatible console.assert).
     *
     * @param condition - Value tested for truthiness.
     * @param args - Optional message arguments shown after "Assertion failed".
     */
    assert: (condition?: unknown, ...args: unknown[]) => {
      if (condition) {
        return;
      }
      const detail = args.length > 0 ? `: ${formatConsoleArgs(args)}` : '';
      pushLog('error', 'assert', `Assertion failed${detail}`);
    },
    /**
     * Clears all captured console lines for this script run and resets group depth.
     */
    clear: () => {
      host.logs.length = 0;
      groupDepth = 0;
    },
    group: (...label: unknown[]) => {
      beginGroup('group', ...label);
    },
    groupCollapsed: (...label: unknown[]) => {
      beginGroup('groupCollapsed', ...label);
    },
    groupEnd: () => {
      if (groupDepth > 0) {
        groupDepth -= 1;
      }
    },
    /**
     * Formats tabular data and logs a structured table payload (ASCII message fallback).
     *
     * @param data - Array or object to display as a table.
     * @param columns - Optional column allow-list.
     */
    table: (data?: unknown, columns?: unknown) => {
      const table = buildConsoleTable(data, columns);
      if (table == null) {
        pushLog('log', 'table', formatConsoleTable(data, columns));
        return;
      }
      const message = table.rows.length === 0 ? '(empty)' : formatConsoleTableData(table);
      pushLog('log', 'table', message, { table });
    },
    /**
     * Starts a named timer for console.timeEnd / timeLog.
     *
     * @param label - Timer name (defaults to `"default"`).
     */
    time: (label?: unknown) => {
      const name = timerLabel(label);
      if (timers.has(name)) {
        pushLog('warn', 'time', `Timer '${name}' already exists`);
        return;
      }
      timers.set(name, Date.now());
    },
    /**
     * Stops a named timer and logs the elapsed milliseconds.
     *
     * @param label - Timer name (defaults to `"default"`).
     */
    timeEnd: (label?: unknown) => {
      const name = timerLabel(label);
      const started = timers.get(name);
      if (started === undefined) {
        pushLog('warn', 'timeEnd', `Timer '${name}' does not exist`);
        return;
      }
      timers.delete(name);
      pushLog('log', 'timeEnd', `${name}: ${Date.now() - started}ms`);
    },
    /**
     * Logs the current elapsed time for a named timer without stopping it.
     *
     * @param label - Timer name (defaults to `"default"`).
     * @param args - Optional extra values appended after the timing line.
     */
    timeLog: (label?: unknown, ...args: unknown[]) => {
      const name = timerLabel(label);
      const started = timers.get(name);
      if (started === undefined) {
        pushLog('warn', 'timeLog', `Timer '${name}' does not exist`);
        return;
      }
      const timing = `${name}: ${Date.now() - started}ms`;
      const extra = args.length > 0 ? ` ${formatConsoleArgs(args)}` : '';
      pushLog('log', 'timeLog', `${timing}${extra}`);
    },
    /**
     * Logs a stack trace with optional message arguments.
     *
     * @param args - Values shown after "Trace:".
     */
    trace: (...args: unknown[]) => {
      const rawStack = new Error().stack;
      pushLog('log', 'trace', formatConsoleTrace(args, rawStack));
    }
  };
}
