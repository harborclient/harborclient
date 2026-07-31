import type {
  ScriptLogEntry,
  ScriptPhase,
  ScriptRunError,
  ScriptTestResult
} from '@harborclient/core/types';
import type { ScriptSelectionLastRunFailure } from '@harborclient/core/ai/scriptReferences';
import type { ConsoleEntry } from '#/renderer/src/store/slices/consoleSlice';
import type { RequestTab } from '#/renderer/src/store/tabs';

/**
 * Optional filters when reading script-run diagnostics for the AI agent.
 */
export interface ScriptRunDiagnosticsFilter {
  /**
   * Optional script phase filter.
   */
  phase?: ScriptPhase;

  /**
   * Optional 1-based script index within the phase.
   */
  scriptIndex?: number;

  /**
   * Optional stable script id filter.
   */
  scriptId?: string;

  /**
   * Optional request tab id to prefer when choosing a console entry.
   */
  requestTabId?: string;
}

/**
 * Compact diagnostics payload returned by get_script_run_diagnostics.
 */
export interface ScriptRunDiagnosticsResult {
  /**
   * Whether a matching console entry was found.
   */
  found: boolean;

  /**
   * Request display name from the console entry, when found.
   */
  requestName?: string;

  /**
   * Console entry timestamp, when found.
   */
  timestamp?: number;

  /**
   * Aggregated script error string from the send.
   */
  scriptError?: string;

  /**
   * Structured script failures with mapped locations.
   */
  scriptErrors?: ScriptRunError[];

  /**
   * Failing hc.test rows only.
   */
  failingTests?: ScriptTestResult[];

  /**
   * Captured console.log / console.error lines with script ownership metadata.
   */
  logs?: ScriptLogEntry[];
}

/**
 * Returns the 1-based script index for a script id on a request tab, when present.
 *
 * @param tab - Request tab owning the script slots.
 * @param phase - Script phase to search.
 * @param scriptId - Stable script id to locate.
 * @returns 1-based index, or null when the id is not on that phase.
 */
export function scriptIndexForId(
  tab: RequestTab,
  phase: ScriptPhase,
  scriptId: string
): number | null {
  const scripts = phase === 'pre' ? tab.draft.pre_request_scripts : tab.draft.post_request_scripts;
  const index = scripts.findIndex((script) => script.id === scriptId);
  return index >= 0 ? index + 1 : null;
}

/**
 * Returns whether a script error matches optional phase/script filters.
 *
 * @param error - Structured script failure.
 * @param filter - Optional phase/scriptId filters.
 * @param tab - Optional tab used to resolve scriptIndex filters.
 * @returns True when the error should be included.
 */
function scriptErrorMatchesFilter(
  error: ScriptRunError,
  filter: ScriptRunDiagnosticsFilter,
  tab?: RequestTab | null
): boolean {
  if (filter.phase && error.phase && error.phase !== filter.phase) {
    return false;
  }
  if (filter.scriptId && error.scriptId && error.scriptId !== filter.scriptId) {
    return false;
  }
  if (filter.scriptIndex != null && filter.phase && tab && error.scriptId) {
    const index = scriptIndexForId(tab, filter.phase, error.scriptId);
    if (index != null && index !== filter.scriptIndex) {
      return false;
    }
  }
  return true;
}

/**
 * Returns whether a test result matches optional phase/script filters.
 *
 * @param test - hc.test result.
 * @param filter - Optional phase/scriptId filters.
 * @param tab - Optional tab used to resolve scriptIndex filters.
 * @returns True when the test should be included.
 */
function testMatchesFilter(
  test: ScriptTestResult,
  filter: ScriptRunDiagnosticsFilter,
  tab?: RequestTab | null
): boolean {
  if (filter.phase && test.phase && test.phase !== filter.phase) {
    return false;
  }
  if (filter.scriptId && test.scriptId && test.scriptId !== filter.scriptId) {
    return false;
  }
  if (filter.scriptIndex != null && filter.phase && tab && test.scriptId) {
    const index = scriptIndexForId(tab, filter.phase, test.scriptId);
    if (index != null && index !== filter.scriptIndex) {
      return false;
    }
  }
  return true;
}

/**
 * Picks the newest console entry matching an optional request tab preference.
 *
 * @param entries - Console entries newest-first.
 * @param requestTabId - Preferred request tab id.
 * @returns Matching entry, or null when none exist.
 */
export function selectConsoleEntryForDiagnostics(
  entries: readonly ConsoleEntry[],
  requestTabId?: string
): ConsoleEntry | null {
  if (entries.length === 0) {
    return null;
  }
  if (requestTabId) {
    const matching = entries.find((entry) => entry.requestTabId === requestTabId);
    if (matching) {
      return matching;
    }
  }
  return entries[0] ?? null;
}

/**
 * Builds AI-facing script diagnostics from console entries and an optional tab.
 *
 * @param entries - Console entries newest-first.
 * @param filter - Optional phase/script filters and preferred tab id.
 * @param tab - Optional active request tab for script-index resolution.
 * @returns Compact diagnostics payload for the model.
 */
export function buildScriptRunDiagnostics(
  entries: readonly ConsoleEntry[],
  filter: ScriptRunDiagnosticsFilter = {},
  tab?: RequestTab | null
): ScriptRunDiagnosticsResult {
  const entry = selectConsoleEntryForDiagnostics(entries, filter.requestTabId ?? tab?.tabId);
  if (!entry) {
    return { found: false };
  }

  const scriptErrors = (entry.scriptErrors ?? []).filter((error) =>
    scriptErrorMatchesFilter(error, filter, tab)
  );
  const failingTests = (entry.tests ?? []).filter(
    (test) => !test.passed && testMatchesFilter(test, filter, tab)
  );

  const hasPhaseFilter = Boolean(filter.phase || filter.scriptId || filter.scriptIndex != null);
  const scriptError =
    hasPhaseFilter && scriptErrors.length === 0
      ? undefined
      : hasPhaseFilter
        ? scriptErrors.map((error) => error.message).join('\n') || undefined
        : entry.scriptError;

  return {
    found: true,
    requestName: entry.requestName,
    timestamp: entry.timestamp,
    scriptError,
    scriptErrors: scriptErrors.length ? scriptErrors : undefined,
    failingTests: failingTests.length ? failingTests : undefined,
    logs: entry.logs?.length ? entry.logs : undefined
  };
}

/**
 * Converts a structured script error into a Copy-to-chat last-run failure.
 *
 * @param error - Script runtime/compile failure.
 * @returns Snapshot failure payload.
 */
export function scriptRunErrorToLastRunFailure(
  error: ScriptRunError
): ScriptSelectionLastRunFailure {
  return {
    kind: 'script-error',
    message: error.message,
    source: error.source,
    line: error.line,
    column: error.column
  };
}

/**
 * Converts a failed hc.test row into a Copy-to-chat last-run failure.
 *
 * @param test - Failed test result.
 * @returns Snapshot failure payload.
 */
export function testResultToLastRunFailure(test: ScriptTestResult): ScriptSelectionLastRunFailure {
  return {
    kind: 'test-failure',
    message: test.error?.trim() || 'Assertion failed',
    testName: test.name,
    expected: test.expected,
    actual: test.actual,
    source: test.source,
    line: test.line,
    column: test.column
  };
}

/**
 * Finds the newest last-run failure for a script slot from console diagnostics.
 *
 * Prefers structured scriptErrors for the slot, then failing tests for the slot.
 *
 * @param entries - Console entries newest-first.
 * @param options - Phase, optional script id/index, and preferred tab.
 * @param tab - Optional request tab for index resolution.
 * @returns Last-run failure, or undefined when none match.
 */
export function findLastRunFailureForScriptSlot(
  entries: readonly ConsoleEntry[],
  options: {
    phase: ScriptPhase;
    scriptIndex: number;
    scriptId?: string;
    requestTabId?: string;
  },
  tab?: RequestTab | null
): ScriptSelectionLastRunFailure | undefined {
  const diagnostics = buildScriptRunDiagnostics(
    entries,
    {
      phase: options.phase,
      scriptIndex: options.scriptIndex,
      scriptId: options.scriptId,
      requestTabId: options.requestTabId
    },
    tab
  );

  const firstError = diagnostics.scriptErrors?.[0];
  if (firstError) {
    return scriptRunErrorToLastRunFailure(firstError);
  }

  const firstFailingTest = diagnostics.failingTests?.[0];
  if (firstFailingTest) {
    return testResultToLastRunFailure(firstFailingTest);
  }

  if (diagnostics.scriptError?.trim()) {
    return {
      kind: 'script-error',
      message: diagnostics.scriptError.trim()
    };
  }

  return undefined;
}
