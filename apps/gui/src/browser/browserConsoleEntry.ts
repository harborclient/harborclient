import type {
  BrowserConsoleEntryPayload,
  ScriptExecutionEvent,
  ScriptLogEntry,
  ScriptPhase,
  ScriptRunError,
  ScriptRunResult,
  ScriptTestResult,
  SendResult
} from '@harborclient/core/types';
import { enrichScriptLogLines } from '@harborclient/core/scripting/scriptLogs';

/**
 * Accumulates pre/post script output for one live-page navigation cycle.
 */
export interface BrowserConsoleAccum {
  /**
   * Wall-clock ms when this navigation cycle began (pre scripts or load start).
   */
  startedAt: number;

  /**
   * Script console lines for the footer Logs section.
   */
  logs: ScriptLogEntry[];

  /**
   * Test assertions collected from pre/post scripts.
   */
  tests: ScriptTestResult[];

  /**
   * Variable / flow-control events from pre/post scripts.
   */
  executionEvents: ScriptExecutionEvent[];

  /**
   * Human-readable script error lines joined into scriptError.
   */
  scriptErrorLines: string[];

  /**
   * Structured script failures for jump-to-editor.
   */
  scriptErrors: ScriptRunError[];
}

/**
 * Creates an empty navigation accumulator stamped with the current time.
 *
 * @returns Fresh accumulator for one navigation cycle.
 */
export function createBrowserConsoleAccum(): BrowserConsoleAccum {
  return {
    startedAt: Date.now(),
    logs: [],
    tests: [],
    executionEvents: [],
    scriptErrorLines: [],
    scriptErrors: []
  };
}

/**
 * Appends one SES sandbox result into the navigation accumulator.
 *
 * @param accum - Navigation accumulator to mutate.
 * @param phase - Whether this script ran as pre or post.
 * @param scriptId - Stable script id from the editor ScriptRef.
 * @param label - Display name used to label logs and errors.
 * @param result - Sandbox result from runScriptInProcess.
 */
export function appendBrowserScriptResult(
  accum: BrowserConsoleAccum,
  phase: ScriptPhase,
  scriptId: string,
  label: string,
  result: Pick<ScriptRunResult, 'logs' | 'tests' | 'executionEvents' | 'error' | 'errorLocation'>
): void {
  if (result.logs.length) {
    accum.logs.push(
      ...enrichScriptLogLines(result.logs, {
        label,
        scriptId,
        phase,
        scope: 'request'
      })
    );
  }
  if (result.executionEvents.length) {
    accum.executionEvents.push(
      ...result.executionEvents.map((event) => ({ ...event, scriptName: label }))
    );
  }
  if (result.tests.length) {
    accum.tests.push(
      ...result.tests.map((test) => ({
        ...test,
        scriptName: label,
        scriptId,
        phase,
        scope: 'request' as const
      }))
    );
  }
  if (result.error) {
    accum.scriptErrorLines.push(`${label}: ${result.error}`);
    accum.scriptErrors.push({
      message: result.error,
      scriptName: label,
      scriptId,
      phase,
      scope: 'request',
      ...result.errorLocation
    });
  }
}

/**
 * Returns whether a finished load should produce a footer console row.
 *
 * Skips the empty about:blank placeholder that Chromium may emit before a
 * real home URL or first navigation.
 *
 * @param url - Committed page URL.
 * @param title - Document title from the guest.
 * @returns True when the navigation should be logged.
 */
export function shouldEmitBrowserConsoleEntry(url: string, title: string): boolean {
  const normalized = url.trim().toLowerCase();
  if (normalized === 'about:blank' || normalized === '') {
    const trimmedTitle = title.trim();
    return trimmedTitle.length > 0 && trimmedTitle.toLowerCase() !== 'browser';
  }
  return true;
}

/**
 * Builds the IPC payload for the renderer console from a page snapshot + accum.
 *
 * @param tabId - Browser tab id.
 * @param result - SendResult page snapshot (timeMs may be overwritten).
 * @param accum - Script output collected for this navigation.
 * @returns Payload for `browser:console-entry`.
 */
export function buildBrowserConsoleEntryPayload(
  tabId: string,
  result: SendResult,
  accum: BrowserConsoleAccum
): BrowserConsoleEntryPayload {
  const timeMs = Math.max(0, Date.now() - accum.startedAt);
  return {
    tabId,
    result: {
      ...result,
      timeMs
    },
    logs: accum.logs.length ? accum.logs : undefined,
    tests: accum.tests.length ? accum.tests : undefined,
    executionEvents: accum.executionEvents.length ? accum.executionEvents : undefined,
    scriptError: accum.scriptErrorLines.length ? accum.scriptErrorLines.join('\n') : undefined,
    scriptErrors: accum.scriptErrors.length ? accum.scriptErrors : undefined
  };
}
