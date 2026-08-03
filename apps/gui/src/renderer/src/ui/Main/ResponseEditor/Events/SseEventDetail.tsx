import type { JSX } from 'react';
import type { SseEvent } from '@harborclient/core/types';

interface Props {
  /**
   * Selected SSE event to display in full.
   */
  event: SseEvent;
}

/**
 * Detail panel for a single selected SSE event.
 *
 * @param props - Selected event.
 * @returns Metadata and full data/raw payloads.
 */
export function SseEventDetail({ event }: Props): JSX.Element {
  return (
    <div className="mt-2 rounded-md border border-separator p-3 text-[14px]" aria-live="polite">
      <dl className="m-0 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
        <dt className="text-muted">Seq</dt>
        <dd className="m-0 font-mono">{event.seq}</dd>
        <dt className="text-muted">Type</dt>
        <dd className="m-0 font-mono">{event.type}</dd>
        <dt className="text-muted">Id</dt>
        <dd className="m-0 font-mono">{event.id ?? '—'}</dd>
        <dt className="text-muted">Received</dt>
        <dd className="m-0 font-mono">{new Date(event.receivedAt).toLocaleString()}</dd>
        {event.retryMs != null ? (
          <>
            <dt className="text-muted">Retry</dt>
            <dd className="m-0 font-mono">{event.retryMs} ms</dd>
          </>
        ) : null}
      </dl>
      <div className="mt-3">
        <div className="mb-1 text-muted">Data</div>
        <pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-field p-2 font-mono text-[14px]">
          {event.data || '(empty)'}
        </pre>
      </div>
      <div className="mt-3">
        <div className="mb-1 text-muted">Raw</div>
        <pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-field p-2 font-mono text-[14px]">
          {event.raw}
        </pre>
      </div>
    </div>
  );
}
