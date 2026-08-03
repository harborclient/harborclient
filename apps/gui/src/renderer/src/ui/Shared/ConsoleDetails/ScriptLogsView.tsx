import type { JSX } from 'react';
import type { ScriptLogEntry, ScriptRunError } from '@harborclient/core/types';
import { EmptySectionLabel } from '@harborclient/sdk/components';
import { ScriptLogErrorRow } from './ScriptLogErrorRow';
import { ScriptLogRow } from './ScriptLogRow';

interface Props {
  /**
   * Console output captured from script console methods (log, error, warn, etc.).
   */
  logs: readonly ScriptLogEntry[];

  /**
   * Aggregated script runtime errors for this send (joined string form).
   */
  scriptError?: string;

  /**
   * Structured script failures with slot metadata and mapped locations.
   */
  scriptErrors?: readonly ScriptRunError[];

  /**
   * Request tab that produced these results; preferred for jump-to-editor.
   */
  requestTabId?: string;
}

/**
 * Renders DevTools-style script log and error rows for the Logs tab and footer console.
 */
export function ScriptLogsView({
  logs,
  scriptError,
  scriptErrors,
  requestTabId
}: Props): JSX.Element {
  const hasStructuredErrors = scriptErrors != null && scriptErrors.length > 0;
  const hasErrors = Boolean(scriptError) || hasStructuredErrors;
  const hasOutput = logs.length > 0 || hasErrors;

  if (!hasOutput) {
    return (
      <div className="flex flex-col">
        <EmptySectionLabel label="No logs" className="mt-4" />
      </div>
    );
  }

  return (
    <div className="flex flex-col" role="log" aria-label="Script logs">
      {logs.map((entry, index) => (
        <ScriptLogRow
          key={`log-${index}-${entry.scriptName}-${entry.message.slice(0, 24)}`}
          entry={entry}
          requestTabId={requestTabId}
        />
      ))}
      {hasStructuredErrors
        ? scriptErrors!.map((error, index) => (
            <ScriptLogErrorRow
              key={`error-${index}-${error.scriptId ?? error.scriptName ?? 'script'}-${error.message.slice(0, 24)}`}
              error={error}
              requestTabId={requestTabId}
            />
          ))
        : null}
      {!hasStructuredErrors && scriptError ? (
        <div className="border-b border-separator bg-danger/10 px-2.5 py-1.5 font-mono text-[14px] text-danger whitespace-pre-wrap last:border-b-0">
          {scriptError}
        </div>
      ) : null}
    </div>
  );
}
