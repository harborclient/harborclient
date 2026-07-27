import type { JSX } from 'react';
import type {
  ScriptExecutionEvent,
  ScriptRunError,
  ScriptTestResult,
  SendResult
} from '@harborclient/core/types';
import { ConsoleDetails } from '#/renderer/src/ui/Shared/ConsoleDetails';

interface Props {
  /**
   * HTTP send result that provides the request and response metadata.
   */
  response: SendResult;

  /**
   * Console output captured from scripts for the last send.
   */
  scriptLogs: string[];

  /**
   * hc.test results from pre/post scripts for the last send.
   */
  testResults: ScriptTestResult[];

  /**
   * Ordered variable and flow-control activity from scripts for the last send.
   */
  executionEvents: ScriptExecutionEvent[];

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
 * Script and request console details for the Console viewer tab.
 */
export function Console({
  response,
  scriptLogs,
  testResults,
  executionEvents,
  scriptError,
  scriptErrors,
  requestTabId
}: Props): JSX.Element {
  return (
    <ConsoleDetails
      flush
      result={response}
      logs={scriptLogs}
      tests={testResults}
      executionEvents={executionEvents}
      scriptError={scriptError}
      scriptErrors={scriptErrors}
      requestTabId={requestTabId}
    />
  );
}
