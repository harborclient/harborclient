import type { JSX } from 'react';
import type { ScriptLogEntry, ScriptRunError } from '@harborclient/core/types';
import { ScriptLogsView } from '#/renderer/src/ui/Shared/ConsoleDetails/ScriptLogsView';

interface Props {
  /**
   * Console output captured from scripts for the last send.
   */
  scriptLogs: ScriptLogEntry[];

  /**
   * Aggregated script runtime errors from the last send.
   */
  scriptError?: string;

  /**
   * Structured script failures with slot metadata and mapped locations.
   */
  scriptErrors?: ScriptRunError[];

  /**
   * Request tab that produced these results; preferred for jump-to-editor.
   */
  requestTabId?: string;
}

/**
 * Response viewer Logs tab: DevTools-style script console output and errors.
 */
export function Logs({ scriptLogs, scriptError, scriptErrors, requestTabId }: Props): JSX.Element {
  return (
    <ScriptLogsView
      logs={scriptLogs}
      scriptError={scriptError}
      scriptErrors={scriptErrors}
      requestTabId={requestTabId}
    />
  );
}
