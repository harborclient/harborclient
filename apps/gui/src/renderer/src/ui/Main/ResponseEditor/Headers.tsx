import type { JSX } from 'react';

import { HeaderNameLink } from './HeaderNameLink';

interface Props {
  /**
   * HTTP response headers from the last send.
   */
  headers: Record<string, string>;
}

/**
 * Response headers key/value table.
 */
export function Headers({ headers }: Props): JSX.Element {
  return (
    <div className="overflow-hidden rounded-md border border-separator">
      {Object.entries(headers).length === 0 ? (
        <div className="p-4 text-center text-[14px] text-muted">No headers</div>
      ) : (
        Object.entries(headers).map(([key, value], index) => (
          <div
            className={`grid grid-cols-[180px_1fr] gap-3 px-2.5 py-1.5 ${index > 0 ? 'border-t border-separator' : ''}`}
            key={key}
          >
            <HeaderNameLink headerName={key} />
            <span className="break-words font-mono text-[14px] text-text-secondary">{value}</span>
          </div>
        ))
      )}
    </div>
  );
}
