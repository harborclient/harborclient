import { useMemo, useState, type JSX } from 'react';
import type { ScriptTestResult, SendResult } from '#/shared/types';
import { CodeEditor } from '#/renderer/src/components/CodeEditor';
import { SegmentedTabs } from '#/renderer/src/components/SegmentedTabs';
import { statusDotClass } from './classes';
import { bodyLanguage, formatBody, formatBytes } from './responseFormatUtils';

interface Props {
  /**
   * Last send result to display, or null before the first send.
   */
  response: SendResult | null;

  /**
   * Whether a request is in flight; shows a loading state when true.
   */
  sending: boolean;

  /**
   * hc.test results from pre/post scripts for the last send.
   */
  testResults: ScriptTestResult[];
}

type ViewerTab = 'body' | 'headers' | 'tests';

/**
 * Displays HTTP response status, timing, body, headers, and script test results.
 */
export function ResponseViewer({ response, sending, testResults }: Props): JSX.Element {
  const [tab, setTab] = useState<ViewerTab>('body');

  const formattedBody = useMemo(() => (response ? formatBody(response.body) : ''), [response]);

  const responseBodyLanguage = useMemo(
    () => (response ? bodyLanguage(response.body, response.headers) : 'text'),
    [response]
  );

  const hasTests = testResults.length > 0;
  const passedCount = testResults.filter((test) => test.passed).length;
  const failedCount = testResults.length - passedCount;
  const effectiveTab = tab === 'tests' && !hasTests ? 'body' : tab;

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
        <SegmentedTabs
          value={effectiveTab}
          onChange={setTab}
          tabs={[
            { value: 'body', label: 'Body' },
            { value: 'headers', label: 'Headers' },
            {
              value: 'tests',
              hidden: !hasTests,
              label: (
                <>
                  Tests
                  <span
                    className={`ml-1.5 text-[12px] ${failedCount > 0 ? 'text-danger' : 'text-muted'}`}
                  >
                    {passedCount}/{testResults.length}
                  </span>
                </>
              )
            }
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {effectiveTab === 'body' && (
          <CodeEditor
            readOnly
            value={formattedBody || '(empty body)'}
            language={responseBodyLanguage}
          />
        )}
        {effectiveTab === 'headers' && (
          <div className="overflow-hidden rounded-md border border-separator">
            {Object.entries(response.headers).length === 0 ? (
              <div className="p-4 text-center text-[13px] text-muted">No headers</div>
            ) : (
              Object.entries(response.headers).map(([key, value], index) => (
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
        )}
        {effectiveTab === 'tests' && hasTests && (
          <div className="overflow-hidden rounded-md border border-separator">
            {testResults.map((test, index) => (
              <div
                key={`${test.name}-${index}`}
                className={`flex items-center gap-2 px-2.5 py-1.5 ${index > 0 ? 'border-t border-separator' : ''}`}
              >
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${test.passed ? 'bg-success' : 'bg-danger'}`}
                />
                <span className="text-[13px] text-text">{test.name}</span>
                {!test.passed && test.error && (
                  <span className="text-[12px] text-danger">{test.error}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
