import type { JSX } from 'react';
import type { SendResult } from '#/shared/types';
import { Button, StatusDot } from '@harborclient/sdk/components';
import { focusableReadonlyClass, statusDotVariant } from '#/renderer/src/ui/Shared/classes';
import { formatBytes } from '#/renderer/src/ui/Shared/responseFormatUtils';

interface Props {
  /**
   * HTTP send result to summarize.
   */
  response: SendResult;

  /**
   * Optional class names for the summary row container.
   */
  className?: string;

  /**
   * Copies the full response export payload to the clipboard.
   */
  onCopy?: () => void;

  /**
   * Exports the full response export payload to a file.
   */
  onExport?: () => void;

  /**
   * Clears the last send result on the active request tab.
   */
  onClear?: () => void;

  /**
   * Whether copy and export actions are enabled.
   */
  canCopyOrExport?: boolean;

  /**
   * Whether the clear action is enabled.
   */
  canClear?: boolean;
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
export function ResponseSummary({
  response,
  className,
  onCopy,
  onExport,
  onClear,
  canCopyOrExport = true,
  canClear = true
}: Props): JSX.Element {
  const showActions = onCopy != null && onExport != null;

  return (
    <div
      className={`flex w-full items-center justify-between gap-3 text-[14px] ${className ?? ''}`}
    >
      <div className="flex items-center gap-3">
        <span
          tabIndex={0}
          aria-label={responseStatusLabel(response)}
          className={`inline-flex items-center gap-1.5 font-medium text-text ${focusableReadonlyClass}`}
        >
          <StatusDot variant={statusDotVariant(response.status)} />
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

      {showActions && (
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canCopyOrExport}
            onClick={onCopy}
          >
            Copy
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canCopyOrExport}
            onClick={onExport}
          >
            Export
          </Button>
          {onClear != null && (
            <Button
              type="button"
              variant="secondary"
              className="disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canClear}
              onClick={onClear}
            >
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
