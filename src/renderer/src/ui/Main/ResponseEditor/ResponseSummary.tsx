import type { JSX } from 'react';
import type { SendResult } from '#/shared/types';
import { focusableReadonlyClass, statusDotClass } from '#/renderer/src/ui/shared/classes';
import { formatBytes } from '#/renderer/src/ui/shared/responseFormatUtils';

interface Props {
  /**
   * HTTP send result to summarize.
   */
  response: SendResult;

  /**
   * Optional class names for the summary row container.
   */
  className?: string;
}

/**
 * Accessible name for the response status metric tab stop.
 *
 * @param response - Last send result shown in the response editor.
 * @returns Screen-reader label for the HTTP status or error state.
 */
function responseStatusLabel(response: SendResult): string {
  if (response.error) {
    return 'Response status: Error';
  }
  return `Response status: ${response.status} ${response.statusText}`;
}

/**
 * Accessible name for the response timing metric tab stop.
 *
 * @param timeMs - Round-trip time in milliseconds.
 * @returns Screen-reader label for response duration.
 */
function responseTimeLabel(timeMs: number): string {
  return `Response time: ${timeMs} milliseconds`;
}

/**
 * Accessible name for the response size metric tab stop.
 *
 * @param sizeBytes - Response body size in bytes.
 * @returns Screen-reader label for response size.
 */
function responseSizeLabel(sizeBytes: number): string {
  return `Response size: ${formatBytes(sizeBytes)}`;
}

/**
 * Compact HTTP status, timing, and size summary shared by the response editor and runner.
 */
export function ResponseSummary({ response, className }: Props): JSX.Element {
  return (
    <div className={`flex items-center gap-3 text-[14px] ${className ?? ''}`}>
      <span
        tabIndex={0}
        aria-label={responseStatusLabel(response)}
        className={`inline-flex items-center gap-1.5 font-medium text-text ${focusableReadonlyClass}`}
      >
        <span
          className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusDotClass(response.status)}`}
          aria-hidden="true"
        />
        {response.error ? 'Error' : `${response.status} ${response.statusText}`}
      </span>
      <span
        tabIndex={0}
        aria-label={responseTimeLabel(response.timeMs)}
        className={`text-muted ${focusableReadonlyClass}`}
      >
        {response.timeMs} ms
      </span>
      <span
        tabIndex={0}
        aria-label={responseSizeLabel(response.sizeBytes)}
        className={`text-muted ${focusableReadonlyClass}`}
      >
        {formatBytes(response.sizeBytes)}
      </span>
    </div>
  );
}
