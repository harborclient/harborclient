import type { JSX } from 'react';
import type { SendResult } from '@harborclient/core/types';
import { ConsoleDetails } from '#/renderer/src/ui/Shared/ConsoleDetails';

interface Props {
  /**
   * HTTP send result that provides the request and response metadata.
   */
  response: SendResult;

  /**
   * Request tab that produced these results; preferred for jump-to-editor.
   */
  requestTabId?: string;
}

/**
 * Request/response metadata for the Console viewer tab.
 *
 * Script logs, errors, and execution traces (as debug lines) live on the
 * dedicated Logs tab.
 */
export function Console({ response, requestTabId }: Props): JSX.Element {
  return (
    <ConsoleDetails flush result={response} requestTabId={requestTabId} showLogsSection={false} />
  );
}
