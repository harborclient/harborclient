import { useMemo, useState, type JSX } from 'react';
import type { SendResult } from '#/shared/types';
import { CodeEditor } from '#/renderer/src/components/CodeEditor';
import { segment, segmentGroup, statusDotClass } from './classes';
import { bodyLanguage, formatBody, formatBytes } from './responseFormat';

interface Props {
  /**
   * Last send result to display, or null before the first send.
   */
  response: SendResult | null;

  /**
   * Whether a request is in flight; shows a loading state when true.
   */
  sending: boolean;
}

type ViewerTab = 'body' | 'headers';

/**
 * Displays HTTP response status, timing, body, and headers.
 */
export function ResponseViewer({ response, sending }: Props): JSX.Element {
  const [tab, setTab] = useState<ViewerTab>('body');

  const formattedBody = useMemo(() => (response ? formatBody(response.body) : ''), [response]);

  const responseBodyLanguage = useMemo(
    () => (response ? bodyLanguage(response.body, response.headers) : 'text'),
    [response]
  );

  const emptyState = (message: string): JSX.Element => (
    <div className="flex flex-1 flex-col p-3">
      <div className="flex flex-1 items-center justify-center text-[13px] text-muted">
        {message}
      </div>
    </div>
  );

  if (sending) {
    return emptyState('Sending request…');
  }

  if (!response) {
    return emptyState('Send a request to see the response');
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <div className="mb-2 flex items-center gap-3 text-[13px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-text">
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusDotClass(response.status)}`}
          />
          {response.error ? 'Error' : `${response.status} ${response.statusText}`}
        </span>
        <span className="text-muted">{response.timeMs} ms</span>
        <span className="text-muted">{formatBytes(response.sizeBytes)}</span>
      </div>

      {response.error && (
        <div className="mb-2 rounded-md bg-danger/10 px-2.5 py-2 text-[13px] text-danger">
          {response.error}
        </div>
      )}

      <div className="mb-2">
        <div className={segmentGroup}>
          <button className={segment(tab === 'body')} onClick={() => setTab('body')}>
            Body
          </button>
          <button className={segment(tab === 'headers')} onClick={() => setTab('headers')}>
            Headers
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'body' && (
          <CodeEditor
            readOnly
            value={formattedBody || '(empty body)'}
            language={responseBodyLanguage}
          />
        )}
        {tab === 'headers' && (
          <div className="overflow-hidden rounded-md border border-separator">
            {Object.entries(response.headers).length === 0 ? (
              <div className="p-4 text-center text-[13px] text-muted">No headers</div>
            ) : (
              Object.entries(response.headers).map(([key, value], index) => (
                <div
                  className={`grid grid-cols-[180px_1fr] gap-3 px-2.5 py-1.5 ${index > 0 ? 'border-t border-separator' : ''}`}
                  key={key}
                >
                  <span className="break-words text-[13px] font-medium text-accent">{key}</span>
                  <span className="break-words font-mono text-[12px] text-text-secondary">
                    {value}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
