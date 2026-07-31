import type { JSX } from 'react';
import type { ScriptExecutionEvent, SendResult } from '@harborclient/core/types';
import { ConsoleDetails } from '#/renderer/src/ui/Shared/ConsoleDetails';

interface Props {
  /**
   * HTTP send result that provides the request and response metadata.
   */
  response: SendResult;

  /**
   * Ordered variable and flow-control activity from scripts for the last send.
   */
  executionEvents: ScriptExecutionEvent[];

  /**
   * Request tab that produced these results; preferred for jump-to-editor.
   */
  requestTabId?: string;
}

/**
 * Script and request console details for the Console viewer tab.
 *
 * Script logs and errors live on the dedicated Logs tab; this view shows
 * general/request/response metadata and the execution trace.
 */
export function Console({ response, executionEvents, requestTabId }: Props): JSX.Element {
  return (
    <ConsoleDetails
      flush
      result={response}
      executionEvents={executionEvents}
      requestTabId={requestTabId}
      showLogsSection={false}
    />
  );
}
