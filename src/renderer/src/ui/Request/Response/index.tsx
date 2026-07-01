import {
  Button,
  SegmentedTabs,
  SegmentedTabPanel,
  SegmentedTabsGroup,
  CodeEditor,
  FaIcon
} from '@harborclient/sdk/components';
import { statusDotClass } from '#/renderer/src/ui/shared/classes';
import { useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { ResponseTabContext } from '#/shared/plugin/types';
import type { ScriptTestResult, SendResult } from '#/shared/types';

import { useSendRequestShortcutHint } from '#/renderer/src/hooks/useSendRequestShortcutHint';
import { faGlobe } from '#/renderer/src/fontawesome';
import { PluginSurface } from '#/renderer/src/plugins/PluginSurface';
import { usePluginResponseTabs } from '#/renderer/src/plugins/pluginHooks';
import { isPluginTabId } from '#/renderer/src/plugins/pluginContextAdapters';
import {
  bodyLanguage,
  formatBody,
  formatBytes,
  isHtmlResponse,
  isImageResponse,
  responseContentType,
  responseTabExportPath,
  responseTabText
} from '#/renderer/src/ui/shared/responseFormatUtils';
import { Headers } from './Headers';
import { HtmlPreview } from './HtmlPreview';
import { ImagePreview } from './ImagePreview';
import { Redirects } from './Redirects';
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
  const sendRequestShortcutHint = useSendRequestShortcutHint();
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

  /**
   * Whether the current response should expose the image preview tab and button.
   */
  const showImagePreview = useMemo(
    () => (response ? isImageResponse(response.headers) : false),
    [response]
  );

  /**
   * Whether the Preview tab should appear for HTML or image responses.
   */
  const showPreviewTab = showHtmlPreview || showImagePreview;

  const hasTests = testResults.length > 0;
  const hasRedirects = (response?.redirects?.length ?? 0) > 0;
  const passedCount = testResults.filter((test) => test.passed).length;
  const failedCount = testResults.length - passedCount;

  /**
   * Plugin tabs shown when there is no HTTP response (always or noResponse when).
   */
  const noResponsePluginTabs = useMemo(
    () => pluginTabs.filter((entry) => entry.when === 'always' || entry.when === 'noResponse'),
    [pluginTabs]
  );

  const pluginOnlyTab =
    !response && noResponsePluginTabs.length > 0 ? noResponsePluginTabs[0]?.id : null;
  const effectiveTab =
    tab === 'tests' && !hasTests
      ? 'body'
      : tab === 'preview' && !showPreviewTab
        ? 'body'
        : tab === 'redirects' && !hasRedirects
          ? 'body'
          : !response &&
              pluginOnlyTab != null &&
              !noResponsePluginTabs.some((entry) => entry.id === tab)
            ? pluginOnlyTab
            : tab;

  /**
   * Copies the active tab content to the clipboard.
   */
  const handleCopy = async (): Promise<void> => {
    if (
      !response ||
      isPluginTabId(effectiveTab) ||
      effectiveTab === 'preview' ||
      effectiveTab === 'redirects'
    ) {
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
    if (
      !response ||
      isPluginTabId(effectiveTab) ||
      effectiveTab === 'preview' ||
      effectiveTab === 'redirects'
    ) {
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
      ...(showPreviewTab ? [{ value: 'preview', label: 'Preview' }] : []),
      { value: 'headers', label: 'Headers' },
      { value: 'redirects', label: 'Redirects', hidden: !hasRedirects },
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
        .filter((entry) => entry.when !== 'noResponse')
        .filter((entry) => entry.when !== 'hasResponse' || response != null)
        .map((entry) => ({
          value: entry.id,
          label: entry.title,
          hidden: entry.when === 'hasResponse' && response == null
        }))
    ],
    [
      failedCount,
      hasRedirects,
      hasTests,
      passedCount,
      pluginTabs,
      response,
      showPreviewTab,
      testResults.length
    ]
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
    if (noResponsePluginTabs.length === 0) {
      return (
        <div className="flex flex-1 flex-col p-3">
          <div
            role="status"
            aria-label={`Send a request to see the response. ${sendRequestShortcutHint}.`}
            className="flex flex-1 flex-col items-center justify-center gap-3 text-muted"
          >
            <FaIcon icon={faGlobe} className="h-12 w-12" aria-hidden />
            <p className="m-0 text-[14px]">{sendRequestShortcutHint}</p>
          </div>
        </div>
      );
    }

    if (noResponsePluginTabs.length === 1) {
      const singleTab = noResponsePluginTabs[0];
      return (
        <div className="flex min-h-0 flex-1 flex-col p-3">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <PluginSurface
              pluginId={singleTab.pluginId}
              contributionId={singleTab.contributionId}
              kind="responseTabs"
              context={responseTabContext}
              resizeMode="fill"
              className="h-full"
            />
          </div>
        </div>
      );
    }

    const pluginTabsOnly = noResponsePluginTabs.map((entry) => ({
      value: entry.id,
      label: entry.title
    }));

    return (
      <div className="flex min-h-0 flex-1 flex-col p-3">
        <SegmentedTabsGroup value={effectiveTab} onChange={setTab} ariaLabel="Response view">
          <div className="mb-2 -mx-3 -mt-2 flex shrink-0 items-center gap-2">
            <SegmentedTabs tabs={pluginTabsOnly} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {noResponsePluginTabs.map((entry) => (
              <SegmentedTabPanel
                key={entry.id}
                value={entry.id}
                className="flex min-h-0 flex-1 flex-col"
              >
                <PluginSurface
                  pluginId={entry.pluginId}
                  contributionId={entry.contributionId}
                  kind="responseTabs"
                  context={responseTabContext}
                  resizeMode="fill"
                  className="h-full"
                />
              </SegmentedTabPanel>
            ))}
          </div>
        </SegmentedTabsGroup>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <div className="mb-2 flex items-center gap-3 text-[14px] border-b border-separator p-3 -mx-3 -mt-2">
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
          <div className="mb-2 -mx-3 -mt-2 flex shrink-0 items-center justify-between gap-2 border-b border-separator">
            <SegmentedTabs tabs={tabs} className="border-none" />

            <div className="flex shrink-0 items-center gap-1 mr-2">
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
            {showPreviewTab && (
              <SegmentedTabPanel value="preview" className="flex min-h-0 flex-1 flex-col">
                {showHtmlPreview ? (
                  <HtmlPreview body={response.body} requestUrl={requestUrl} />
                ) : (
                  <ImagePreview
                    bodyBase64={response.bodyBase64}
                    contentType={responseContentType(response.headers)}
                  />
                )}
              </SegmentedTabPanel>
            )}
            <SegmentedTabPanel value="headers">
              <Headers headers={response.headers} />
            </SegmentedTabPanel>
            {hasRedirects && (
              <SegmentedTabPanel value="redirects">
                <Redirects redirects={response.redirects ?? []} />
              </SegmentedTabPanel>
            )}
            {hasTests && (
              <SegmentedTabPanel value="tests">
                <Tests testResults={testResults} />
              </SegmentedTabPanel>
            )}
            {pluginTabs
              .filter((entry) => entry.when !== 'noResponse')
              .map((entry) => (
                <SegmentedTabPanel
                  key={entry.id}
                  value={entry.id}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <PluginSurface
                    pluginId={entry.pluginId}
                    contributionId={entry.contributionId}
                    kind="responseTabs"
                    context={responseTabContext}
                    resizeMode="fill"
                    className="h-full"
                  />
                </SegmentedTabPanel>
              ))}
          </div>
        </SegmentedTabsGroup>
      </div>
    </div>
  );
}
