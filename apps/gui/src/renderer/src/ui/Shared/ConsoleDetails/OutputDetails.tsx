import type { JSX } from 'react';
import type { ScriptRunError, ScriptTestResult } from '@harborclient/core/types';
import { TestResultsTable } from '#/renderer/src/ui/Shared/TestResultsTable';
import { ScriptErrorList } from '#/renderer/src/ui/Shared/ScriptErrorList';

interface Props {
  /**
   * Console output captured from script console.log/console.error calls.
   */
  logs: readonly string[];

  /**
   * hc.test assertion results captured while scripts ran.
   */
  tests: readonly ScriptTestResult[];

  /**
   * Aggregated script runtime errors for this send (joined string form).
   */
  scriptError?: string;

  /**
   * Structured script failures with slot metadata and mapped locations; when
   * present, errors render as clickable jump-to-editor rows.
   */
  scriptErrors?: readonly ScriptRunError[];

  /**
   * Request tab that produced these results; preferred for jump-to-editor.
   */
  requestTabId?: string;
}

/**
 * Renders script output, test results, and runtime errors for a single send.
 */
export function OutputDetails({
  logs,
  tests,
  scriptError,
  scriptErrors,
  requestTabId
}: Props): JSX.Element {
  const hasErrors = Boolean(scriptError) || (scriptErrors != null && scriptErrors.length > 0);
  const hasOutput = logs.length > 0 || tests.length > 0 || hasErrors;

  if (!hasOutput) {
    return <div className="px-2.5 py-2 text-center text-[14px] text-muted">No output</div>;
  }

  return (
    <div className="flex flex-col gap-2 px-2.5 py-2">
      {hasErrors && (
        <ScriptErrorList
          scriptErrors={scriptErrors}
          fallbackText={scriptError}
          requestTabId={requestTabId}
        />
      )}
      {logs.length > 0 && (
        <pre className="m-0 overflow-auto rounded-md border border-separator bg-control px-2.5 py-2 font-mono text-[14px] text-text whitespace-pre-wrap">
          {logs.join('\n')}
        </pre>
      )}
      {tests.length > 0 && <TestResultsTable testResults={tests} requestTabId={requestTabId} />}
    </div>
  );
}
