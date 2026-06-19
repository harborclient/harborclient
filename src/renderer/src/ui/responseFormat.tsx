import type { JSX } from 'react';
import type { SendResult } from '#/shared/types';
import { CodeEditor } from '#/renderer/src/components/CodeEditor';

const detailRow =
  'grid grid-cols-[180px_1fr] gap-3 px-2.5 py-1.5 border-t border-separator first:border-t-0';

/**
 * Pretty-prints JSON response bodies when valid; returns raw text otherwise.
 *
 * @param body - Raw response body string.
 * @returns Formatted body for display.
 */
export function formatBody(body: string): string {
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
export function isValidJson(body: string): boolean {
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
export function bodyLanguage(body: string, headers?: Record<string, string>): 'json' | 'text' {
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
export function formatBytes(bytes: number): string {
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
export function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
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
export function SectionTitle({ title }: { title: string }): JSX.Element {
  return (
    <h3 className="m-0 mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
      {title}
    </h3>
  );
}

interface RequestDetailsProps {
  result: SendResult;
}

/**
 * Renders expandable request/response inspector details for a send result.
 */
export function RequestDetails({ result }: RequestDetailsProps): JSX.Element {
  const formattedRequestBody = result.request ? formatBody(result.request.body) : '';
  const formattedResponseBody = formatBody(result.body);
  const requestBodyLanguage = result.request
    ? bodyLanguage(result.request.body, result.request.headers)
    : 'text';
  const responseBodyLanguage = bodyLanguage(result.body, result.headers);

  if (!result.request) {
    return <div className="text-[13px] text-muted">No request data</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {result.error && (
        <div className="rounded-md bg-danger/10 px-2.5 py-2 text-[13px] text-danger">
          {result.error}
        </div>
      )}

      <div>
        <SectionTitle title="General" />
        <div className="overflow-hidden rounded-md border border-separator">
          <DetailRow label="Request URL" value={result.request.url} />
          <DetailRow label="Request Method" value={result.request.method} />
          <DetailRow
            label="Status Code"
            value={result.error ? 'Error' : `${result.status} ${result.statusText}`}
          />
        </div>
      </div>

      <div>
        <SectionTitle title="Request Headers" />
        <div className="overflow-hidden rounded-md border border-separator">
          {Object.entries(result.request.headers).length === 0 ? (
            <div className="p-4 text-center text-[13px] text-muted">No headers</div>
          ) : (
            Object.entries(result.request.headers).map(([key, value], index) => (
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
      </div>

      <div>
        <SectionTitle title="Payload" />
        {result.request.body ? (
          <CodeEditor readOnly value={formattedRequestBody} language={requestBodyLanguage} />
        ) : (
          <div className="rounded-md border border-separator px-2.5 py-2 text-[13px] text-muted">
            (no payload)
          </div>
        )}
      </div>

      <div>
        <SectionTitle title="Response Body" />
        <CodeEditor
          readOnly
          value={formattedResponseBody || '(empty body)'}
          language={responseBodyLanguage}
        />
      </div>
    </div>
  );
}
