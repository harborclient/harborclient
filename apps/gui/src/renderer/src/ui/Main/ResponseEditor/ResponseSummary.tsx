import type { JSX } from 'react';
import type { SendResult } from '@harborclient/core/types';
import { Button, FaIcon, StatusDot } from '@harborclient/sdk/components';
import { faExpand } from '#/renderer/src/fontawesome';
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
   * Opens the active response viewer sub-tab in a full page tab.
   */
  onExpand?: () => void;

  /**
   * Human-readable name of the active viewer tab for the expand button label.
   */
  expandTabLabel?: string;

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
  onExpand,
  expandTabLabel,
  canCopyOrExport = true,
  canClear = true
}: Props): JSX.Element {
  const showActions = onCopy != null && onExport != null;
  const expandLabel =
    expandTabLabel != null ? `Open ${expandTabLabel} in full page` : 'Open in full page';

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
          {onExpand != null && (
            <Button
              type="button"
              variant="secondary"
              title={expandLabel}
              aria-label={expandLabel}
              className="px-2"
              onClick={onExpand}
            >
              <FaIcon icon={faExpand} className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            title="Copy response to clipboard"
            aria-label="Copy response to clipboard"
            className="disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canCopyOrExport}
            onClick={onCopy}
          >
            Copy
          </Button>
          <Button
            type="button"
            variant="secondary"
            title="Export response to a file"
            aria-label="Export response to a file"
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
              title="Clear response"
              aria-label="Clear response"
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
