import {
  Button,
  SegmentedTabs,
  SegmentedTabPanel,
  SegmentedTabsGroup,
  CodeEditor
} from '@harborclient/sdk/components';
import { statusDotClass } from '#/renderer/src/ui/shared/classes';
import { useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { ResponseTabContext } from '#/shared/plugin/types';
import type { ScriptTestResult, SendResult } from '#/shared/types';

import { usePluginResponseTabs } from '#/renderer/src/plugins/pluginHooks';
import { isPluginTabId } from '#/renderer/src/plugins/pluginContextAdapters';
import {
  bodyLanguage,
  formatBody,
  formatBytes,
  isHtmlResponse,
  responseTabExportPath,
  responseTabText
} from '#/renderer/src/ui/shared/responseFormatUtils';
import { Headers } from './Headers';
import { HtmlPreview } from './HtmlPreview';
import { Tests } from './Tests';

interface Props {
  /**
   * Last send result to display, or null before the first send.
   */
  response: SendResult | null;

  /**
   * Read-only plugin tab context shared with contributed tabs.
   */
  responseTabContext: ResponseTabContext;

  /**
   * Whether a request is in flight; shows a loading state when true.
   */
  sending: boolean;

  /**
   * hc.test results from pre/post scripts for the last send.
   */
  testResults: ScriptTestResult[];

  /**
   * Cancels the in-flight request.
   */
  onCancel: () => void;

  /**
   * URL of the active request, used to resolve relative assets in HTML preview.
   */
  requestUrl: string;
}

/**
 * Displays HTTP response status, timing, body, headers, and script test results.
 */
export function Response({
  response,
  responseTabContext,
  sending,
  testResults,
  onCancel,
  requestUrl
}: Props): JSX.Element {
  const pluginTabs = usePluginResponseTabs();
  const [tab, setTab] = useState<string>('body');

  /**
   * Pretty-prints the response body for display in the read-only editor.
   */
  const formattedBody = useMemo(() => (response ? formatBody(response.body) : ''), [response]);

  /**
   * Chooses JSON or plain-text highlighting based on response content and headers.
   */
  const responseBodyLanguage = useMemo(
    () => (response ? bodyLanguage(response.body, response.headers) : 'text'),
    [response]
  );

  /**
   * Whether the current response should expose the HTML preview tab and button.
   */
  const showHtmlPreview = useMemo(
    () => (response ? isHtmlResponse(response.body, response.headers) : false),
    [response]
  );

  const hasTests = testResults.length > 0;
  const passedCount = testResults.filter((test) => test.passed).length;
  const failedCount = testResults.length - passedCount;
  const effectiveTab =
    tab === 'tests' && !hasTests ? 'body' : tab === 'preview' && !showHtmlPreview ? 'body' : tab;

  /**
   * Copies the active tab content to the clipboard.
   */
  const handleCopy = async (): Promise<void> => {
    if (!response || isPluginTabId(effectiveTab) || effectiveTab === 'preview') {
      return;
    }
    const text = responseTabText(
      effectiveTab as 'body' | 'headers' | 'tests',
      response.body,
      response.headers,
      testResults
    );
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  /**
   * Exports the active tab content to a file via a native save dialog.
   */
  const handleExport = async (): Promise<void> => {
    if (!response || isPluginTabId(effectiveTab) || effectiveTab === 'preview') {
      return;
    }
    const content = responseTabText(
      effectiveTab as 'body' | 'headers' | 'tests',
      response.body,
      response.headers,
      testResults
    );
    const defaultPath = responseTabExportPath(
      effectiveTab as 'body' | 'headers' | 'tests',
      response.body,
      response.headers
    );
    try {
      const result = await window.api.saveTextFile(content, defaultPath);
      if (result.canceled) return;
      toast.success('Response exported');
    } catch {
      toast.error('Failed to export response');
    }
  };

  /**
   * Built-in and plugin response tabs merged for SegmentedTabs.
   */
  const tabs = useMemo(
    () => [
      { value: 'body', label: 'Body' },
      ...(showHtmlPreview ? [{ value: 'preview', label: 'Preview' }] : []),
      { value: 'headers', label: 'Headers' },
      {
        value: 'tests',
        hidden: !hasTests,
        label: (
          <>
            Tests
            <span
              className={`ml-1.5 text-[14px] ${failedCount > 0 ? 'text-danger' : 'text-muted'}`}
            >
              {passedCount}/{testResults.length}
            </span>
          </>
        )
      },
      ...pluginTabs
        .filter((entry) => entry.when !== 'hasResponse' || response != null)
        .map((entry) => ({
          value: entry.id,
          label: entry.title,
          hidden: entry.when === 'hasResponse' && response == null
        }))
    ],
    [failedCount, hasTests, passedCount, pluginTabs, response, showHtmlPreview, testResults.length]
  );

  /**
   * Renders a centered placeholder when there is no response content to show.
   *
   * @param message - User-facing empty-state text.
   */
  const emptyState = (message: string): JSX.Element => (
    <div className="flex flex-1 flex-col p-3">
      <div className="flex flex-1 items-center justify-center text-[14px] text-muted">
        {message}
      </div>
    </div>
  );

  if (sending) {
    return (
      <div className="flex flex-1 flex-col p-3">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-[14px] text-muted">
          <div role="status" aria-label="Sending request">
            <span>Sending request…</span>
          </div>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (!response) {
    return emptyState('Send a request to see the response');
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <div className="mb-2 flex items-center gap-3 text-[14px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-text">
          <span
            className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusDotClass(response.status)}`}
            aria-hidden="true"
          />
          {response.error ? 'Error' : `${response.status} ${response.statusText}`}
        </span>
        <span className="text-muted">{response.timeMs} ms</span>
        <span className="text-muted">{formatBytes(response.sizeBytes)}</span>
      </div>

      {response.error && (
        <div className="mb-2 rounded-md bg-danger/10 px-2.5 py-2 text-[14px] text-danger">
          {response.error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <SegmentedTabsGroup value={effectiveTab} onChange={setTab} ariaLabel="Response view">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <SegmentedTabs tabs={tabs} />
            <div className="flex shrink-0 items-center gap-1">
              <Button type="button" variant="toolbar" onClick={() => void handleCopy()}>
                Copy
              </Button>
              <Button type="button" variant="toolbar" onClick={() => void handleExport()}>
                Export
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-auto">
            <SegmentedTabPanel value="body">
              <CodeEditor
                readOnly
                value={formattedBody || '(empty body)'}
                language={responseBodyLanguage}
              />
            </SegmentedTabPanel>
            {showHtmlPreview && (
              <SegmentedTabPanel value="preview" className="flex min-h-0 flex-1 flex-col">
                <HtmlPreview body={response.body} requestUrl={requestUrl} />
              </SegmentedTabPanel>
            )}
            <SegmentedTabPanel value="headers">
              <Headers headers={response.headers} />
            </SegmentedTabPanel>
            {hasTests && (
              <SegmentedTabPanel value="tests">
                <Tests testResults={testResults} />
              </SegmentedTabPanel>
            )}
            {pluginTabs.map((entry) => {
              const Component = entry.Component;
              return (
                <SegmentedTabPanel key={entry.id} value={entry.id}>
                  <Component context={responseTabContext} />
                </SegmentedTabPanel>
              );
            })}
          </div>
        </SegmentedTabsGroup>
      </div>
    </div>
  );
}
