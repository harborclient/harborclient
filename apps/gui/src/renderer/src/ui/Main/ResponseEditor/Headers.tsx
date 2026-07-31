import type { JSX } from 'react';
import { ConsoleSelectionHost } from '#/renderer/src/ui/Main/ResponseEditor/consoleSelection/ConsoleSelectionHost';
import { consoleCellDataAttrs } from '#/renderer/src/ui/Main/ResponseEditor/consoleSelection/captureConsoleSelection';
import { HeaderNameLink } from './HeaderNameLink';

interface Props {
  /**
   * HTTP response headers from the last send.
   */
  headers: Record<string, string>;

  /**
   * Optional send metadata for console-row Copy to chat snapshots.
   */
  requestName?: string;

  /**
   * HTTP status code for console-row snapshots.
   */
  status?: number;

  /**
   * HTTP status text for console-row snapshots.
   */
  statusText?: string;

  /**
   * Transport error when the send failed.
   */
  error?: string;
}

/**
 * Response headers key/value table.
 */
export function Headers({ headers, requestName, status, statusText, error }: Props): JSX.Element {
  return (
    <ConsoleSelectionHost
      meta={{
        ...(requestName != null ? { requestName } : {}),
        ...(status != null ? { status } : {}),
        ...(statusText != null ? { statusText } : {}),
        ...(error != null ? { error } : {})
      }}
    >
      <div className="overflow-hidden rounded-md border border-separator">
        {Object.entries(headers).length === 0 ? (
          <div className="p-4 text-center text-[14px] text-muted">No headers</div>
        ) : (
          Object.entries(headers).map(([key, value], index) => {
            const cellAttrs = consoleCellDataAttrs('headers', key);
            return (
              <div
                className={`grid grid-cols-[180px_1fr] gap-3 px-2.5 py-1.5 ${index > 0 ? 'border-t border-separator' : ''}`}
                key={key}
              >
                <HeaderNameLink headerName={key} />
                <span
                  className="break-words font-mono text-[14px] text-text-secondary"
                  {...(cellAttrs ?? {})}
                >
                  {value}
                </span>
              </div>
            );
          })
        )}
      </div>
    </ConsoleSelectionHost>
  );
}
