import type { JSX } from 'react';
import type { SendResult } from '#/shared/types';
import { CodeEditor } from '#/renderer/src/components/CodeEditor';
import {
  bodyLanguage,
  formatBody,
  formatSentRequestBody,
  sentRequestBodyLanguage,
  sentRequestBodySectionTitle
} from '#/renderer/src/ui/shared/responseFormatUtils';
import { SectionTitle } from './SectionTitle';

const detailRow =
  'grid grid-cols-[180px_1fr] gap-3 px-2.5 py-1.5 border-t border-separator first:border-t-0';

/**
 * Renders a key-value detail row for inspector-style panels.
 */
function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className={detailRow}>
      <span className="break-words text-[13px] font-medium">{label}</span>
      <span className="break-words font-mono text-[12px] text-text-secondary">{value}</span>
    </div>
  );
}

interface Props {
  result: SendResult;
}

/**
 * Renders expandable request/response inspector details for a send result.
 */
export function RequestDetails({ result }: Props): JSX.Element {
  const formattedRequestBody = result.request
    ? formatSentRequestBody(result.request.body, result.request.bodyType)
    : '';
  const formattedResponseBody = formatBody(result.body);
  const requestBodyLanguage = result.request
    ? sentRequestBodyLanguage(result.request.body, result.request.bodyType, result.request.headers)
    : 'text';
  const responseBodyLanguage = bodyLanguage(result.body, result.headers);
  const requestBodySectionTitle = sentRequestBodySectionTitle(result.request?.bodyType);
  const isMultipartSummary = result.request?.bodyType === 'multipart';

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
                <span className="break-words text-[13px] font-medium">{key}</span>
                <span className="break-words font-mono text-[12px] text-text-secondary">
                  {value}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <SectionTitle title={requestBodySectionTitle} />
        {isMultipartSummary && (
          <p className="m-0 mb-1.5 text-[12px] text-muted">
            Summary of fields sent — not the raw multipart body.
          </p>
        )}
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
