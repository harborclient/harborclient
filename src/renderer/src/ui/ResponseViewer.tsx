import { useMemo, useState, type JSX } from 'react';
import type { SendResult } from '#/shared/types';
import { CodeEditor } from '#/renderer/src/components/CodeEditor';
import { segment, segmentGroup, statusDotClass } from './classes';

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

type ViewerTab = 'body' | 'headers' | 'console';

const detailRow =
  'grid grid-cols-[180px_1fr] gap-3 px-2.5 py-1.5 border-t border-separator first:border-t-0';

/**
 * Pretty-prints JSON response bodies when valid; returns raw text otherwise.
 *
 * @param body - Raw response body string.
 * @returns Formatted body for display.
 */
function formatBody(body: string): string {
  if (!body) return '';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

/**
 * Returns true when the body is valid JSON.
 *
 * @param body - Raw body string.
 */
function isValidJson(body: string): boolean {
  if (!body.trim()) return false;
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

/**
 * Chooses a syntax mode from content-type or JSON validity.
 *
 * @param body - Raw body string.
 * @param headers - Response headers map.
 */
function bodyLanguage(body: string, headers?: Record<string, string>): 'json' | 'text' {
  const contentType = headers?.['content-type'] ?? headers?.['Content-Type'] ?? '';
  if (contentType.includes('json')) return 'json';
  return isValidJson(body) ? 'json' : 'text';
}

/**
 * Formats a byte count as B, KB, or MB.
 *
 * @param bytes - Response body size in bytes.
 * @returns Human-readable size string.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Renders a key-value detail row for inspector-style panels.
 *
 * @param label - Field label shown in the left column.
 * @param value - Field value shown in the right column.
 */
function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className={detailRow}>
      <span className="break-words text-[13px] font-medium text-accent">{label}</span>
      <span className="break-words font-mono text-[12px] text-text-secondary">{value}</span>
    </div>
  );
}

/**
 * Renders a section heading for inspector-style panels.
 *
 * @param title - Section title.
 */
function SectionTitle({ title }: { title: string }): JSX.Element {
  return (
    <h3 className="m-0 mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
      {title}
    </h3>
  );
}

/**
 * Displays HTTP response status, timing, body, and headers.
 */
export function ResponseViewer({ response, sending }: Props): JSX.Element {
  const [tab, setTab] = useState<ViewerTab>('body');

  const formattedBody = useMemo(() => (response ? formatBody(response.body) : ''), [response]);

  const formattedRequestBody = useMemo(
    () => (response?.request ? formatBody(response.request.body) : ''),
    [response]
  );

  const responseBodyLanguage = useMemo(
    () => (response ? bodyLanguage(response.body, response.headers) : 'text'),
    [response]
  );

  const requestBodyLanguage = useMemo(
    () =>
      response?.request ? bodyLanguage(response.request.body, response.request.headers) : 'text',
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
          <button className={segment(tab === 'console')} onClick={() => setTab('console')}>
            Console
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
        {tab === 'console' && (
          <div className="flex flex-col gap-4">
            {!response.request ? (
              <div className="text-[13px] text-muted">No request data</div>
            ) : (
              <>
                <div>
                  <SectionTitle title="General" />
                  <div className="overflow-hidden rounded-md border border-separator">
                    <DetailRow label="Request URL" value={response.request.url} />
                    <DetailRow label="Request Method" value={response.request.method} />
                    <DetailRow
                      label="Status Code"
                      value={response.error ? 'Error' : `${response.status} ${response.statusText}`}
                    />
                  </div>
                </div>

                <div>
                  <SectionTitle title="Request Headers" />
                  <div className="overflow-hidden rounded-md border border-separator">
                    {Object.entries(response.request.headers).length === 0 ? (
                      <div className="p-4 text-center text-[13px] text-muted">No headers</div>
                    ) : (
                      Object.entries(response.request.headers).map(([key, value], index) => (
                        <div
                          className={`grid grid-cols-[180px_1fr] gap-3 px-2.5 py-1.5 ${index > 0 ? 'border-t border-separator' : ''}`}
                          key={key}
                        >
                          <span className="break-words text-[13px] font-medium text-accent">
                            {key}
                          </span>
                          <span className="break-words font-mono text-[12px] text-text-secondary">
                            {value}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <SectionTitle title="Payload" />
                  {response.request.body ? (
                    <CodeEditor
                      readOnly
                      value={formattedRequestBody}
                      language={requestBodyLanguage}
                    />
                  ) : (
                    <div className="rounded-md border border-separator px-2.5 py-2 text-[13px] text-muted">
                      (no payload)
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
