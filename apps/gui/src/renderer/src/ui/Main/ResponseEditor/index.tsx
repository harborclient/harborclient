import { Scrollbars } from '#/renderer/src/ui/Shared/Scrollbars';
import {
  Button,
  SegmentedTabs,
  SegmentedTabPanel,
  SegmentedTabsGroup,
  FaIcon
} from '@harborclient/sdk/components';
import { useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { ResponseTabContext } from '@harborclient/core/plugin/types';
import type {
  ScriptExecutionEvent,
  ScriptLogEntry,
  ScriptRunError,
  ScriptTestResult,
  SendResult
} from '@harborclient/core/types';

import { useSendRequestShortcutHint } from '#/renderer/src/hooks/useSendRequestShortcutHint';
import { faGlobe } from '#/renderer/src/fontawesome';
import { HostedSurface } from '#/renderer/src/plugins/HostedSurface';
import { usePluginResponseTabs } from '#/renderer/src/plugins/pluginHooks';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { openPageTab, setResponseViewerTab } from '#/renderer/src/store/slices/tabsSlice';
import { isRequestTab } from '#/renderer/src/store/tabs';
import {
  buildResponseExport,
  isHtmlResponse,
  isImageResponse,
  resolveInitialResponseViewerTab
} from '#/renderer/src/ui/Shared/responseFormatUtils';
import { ResponseSummary } from './ResponseSummary';
import { ResponseViewerPanel } from './ResponseViewerPanel';
import {
  isResponseViewerTab,
  RESPONSE_VIEWER_TAB_LABELS,
  type ResponseViewerTab
} from './responseViewerTabs';

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
   * Console output captured from scripts for the last send.
   */
  scriptLogs: ScriptLogEntry[];

  /**
   * Ordered variable and flow-control activity from scripts for the last send.
   */
  executionEvents: ScriptExecutionEvent[];

  /**
   * Aggregated script runtime errors from the last send.
   */
  scriptError?: string;

  /**
   * Structured script failures with slot metadata and mapped locations; when
   * present, errors render as clickable jump-to-editor rows.
   */
  scriptErrors?: ScriptRunError[];

  /**
   * Cancels the in-flight request.
   */
  onCancel: () => void;

  /**
   * Clears the last send result on the active request tab. Omitted in read-only
   * embeds such as the collection runner result modal.
   */
  onClear?: () => void;

  /**
   * Closes an embedded response panel (for example workflow Results). When set,
   * renders an X control after Clear in the summary toolbar.
   */
  onClose?: () => void;

  /**
   * URL of the active request, used to resolve relative assets in HTML preview.
   */
  requestUrl: string;

  /**
   * Request tab that owns this response; preferred for jump-to-editor from Tests/Console.
   */
  requestTabId?: string;
}

/**
 * Shared props passed into each built-in {@link ResponseViewerPanel}.
 */
interface ViewerPanelProps {
  response: SendResult;
  requestUrl: string;
  testResults: ScriptTestResult[];
  scriptLogs: ScriptLogEntry[];
  executionEvents: ScriptExecutionEvent[];
  scriptError?: string;
  scriptErrors?: ScriptRunError[];
  requestTabId?: string;
  requestName?: string;
}

/**
 * Displays HTTP response status, timing, body, headers, script tests, and console output.
 */
export function ResponseEditor({
  response,
  responseTabContext,
  sending,
  testResults,
  scriptLogs,
  executionEvents,
  scriptError,
  scriptErrors,
  onCancel,
  onClear,
  onClose,
  requestUrl,
  requestTabId
}: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const pluginTabs = usePluginResponseTabs();
  const sendRequestShortcutHint = useSendRequestShortcutHint();
  /**
   * Session-stored viewer tab for this request tab, if the parent provided one.
   */
  const storedViewerTab = useAppSelector((state) => {
    if (requestTabId == null) return undefined;
    const tab = state.tabs.tabs.find((entry) => entry.tabId === requestTabId);
    return tab && isRequestTab(tab) ? tab.responseViewerTab : undefined;
  });
  /**
   * Owning request tab draft name for expand page titles.
   */
  const requestName = useAppSelector((state) => {
    if (requestTabId == null) return 'Request';
    const tab = state.tabs.tabs.find((entry) => entry.tabId === requestTabId);
    return tab && isRequestTab(tab) ? tab.draft.name || 'Request' : 'Request';
  });
  const [tabState, setTabState] = useState<{ response: SendResult | null; tab: string }>(() => ({
    response,
    tab: resolveInitialResponseViewerTab(storedViewerTab, response)
  }));

  /**
   * Writes the selected response viewer tab onto the owning request tab so it
   * survives unmount when opening a script-editor page from a test result.
   */
  useEffect(() => {
    if (requestTabId == null) return;
    dispatch(setResponseViewerTab({ tabId: requestTabId, tab: tabState.tab }));
  }, [dispatch, requestTabId, tabState.tab]);

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

  let tab = tabState.tab;
  if (response !== tabState.response) {
    tab = response && showPreviewTab ? 'preview' : tabState.tab;
    setTabState({ response, tab });
  }

  /**
   * Updates the selected response tab while preserving the response identity used
   * to detect newly completed sends.
   *
   * @param nextTab - Response view selected by the user.
   */
  const setTab = (nextTab: string): void => {
    setTabState((current) => ({ ...current, tab: nextTab }));
  };

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
  const canCopyOrExport = response != null;
  const canClear = response != null && onClear != null;
  const canExpand = response != null && requestTabId != null && isResponseViewerTab(effectiveTab);
  const expandTabLabel = canExpand
    ? RESPONSE_VIEWER_TAB_LABELS[effectiveTab as ResponseViewerTab]
    : undefined;

  /**
   * Preview and plugin response tabs render iframe or fill-mode plugin surfaces
   * that must stretch to the remaining editor height. OverlayScrollbars breaks
   * that flex chain, so those tabs use a plain overflow-hidden container instead.
   */
  const usesFillLayout =
    effectiveTab === 'preview' ||
    pluginTabs.some((entry) => entry.when !== 'noResponse' && entry.id === effectiveTab);

  /**
   * Copies the full response export payload to the clipboard.
   */
  const handleCopy = async (): Promise<void> => {
    if (!canCopyOrExport || !response) {
      return;
    }
    const payload = buildResponseExport(
      response,
      testResults,
      scriptLogs,
      executionEvents,
      scriptError,
      requestUrl
    );
    const text = JSON.stringify(payload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  /**
   * Clears the last send result and related script output on the active tab.
   */
  const handleClear = (): void => {
    if (!canClear || !onClear) {
      return;
    }
    onClear();
  };

  /**
   * Exports the full response export payload to a file via a native save dialog.
   */
  const handleExport = async (): Promise<void> => {
    if (!canCopyOrExport || !response) {
      return;
    }
    const payload = buildResponseExport(
      response,
      testResults,
      scriptLogs,
      executionEvents,
      scriptError,
      requestUrl
    );
    const content = JSON.stringify(payload, null, 2);
    try {
      const result = await window.api.saveTextFile(content, 'response.json');
      if (result.canceled) return;
      toast.success('Response exported');
    } catch {
      toast.error('Failed to export response');
    }
  };

  /**
   * Opens the active built-in response viewer sub-tab in a full page tab.
   */
  const handleExpand = (): void => {
    if (!canExpand || requestTabId == null || !isResponseViewerTab(effectiveTab)) {
      return;
    }
    const viewerLabel = RESPONSE_VIEWER_TAB_LABELS[effectiveTab];
    dispatch(
      openPageTab({
        type: 'response-viewer',
        requestTabId,
        viewerTab: effectiveTab,
        label: `${requestName} — ${viewerLabel}`
      })
    );
  };

  /**
   * Built-in and plugin response tabs merged for SegmentedTabs.
   */
  const tabs = useMemo(
    () => [
      { value: 'body', label: 'Body' },
      ...(showPreviewTab ? [{ value: 'preview', label: 'Preview' }] : []),
      { value: 'headers', label: 'Headers' },
      { value: 'timing', label: 'Timing' },
      { value: 'console', label: 'Console' },
      { value: 'logs', label: 'Logs' },
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
            <HostedSurface
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
                <HostedSurface
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

  const panelProps: ViewerPanelProps = {
    response,
    requestUrl,
    testResults,
    scriptLogs,
    executionEvents,
    scriptError,
    scriptErrors,
    requestTabId,
    requestName
  };

  /**
   * Tab panel bodies rendered inside either a fill-height container or Scrollbars
   * depending on whether the active tab needs to stretch (preview, plugin tabs).
   */
  const tabPanels = (
    <>
      <SegmentedTabPanel value="body">
        <ResponseViewerPanel viewerTab="body" {...panelProps} />
      </SegmentedTabPanel>
      {showPreviewTab && (
        <SegmentedTabPanel value="preview" className="flex min-h-0 flex-1 flex-col">
          <ResponseViewerPanel viewerTab="preview" {...panelProps} />
        </SegmentedTabPanel>
      )}
      <SegmentedTabPanel value="headers">
        <ResponseViewerPanel viewerTab="headers" {...panelProps} />
      </SegmentedTabPanel>
      <SegmentedTabPanel value="timing">
        <ResponseViewerPanel viewerTab="timing" {...panelProps} />
      </SegmentedTabPanel>
      <SegmentedTabPanel value="console">
        <ResponseViewerPanel viewerTab="console" {...panelProps} />
      </SegmentedTabPanel>
      <SegmentedTabPanel value="logs">
        <ResponseViewerPanel viewerTab="logs" {...panelProps} />
      </SegmentedTabPanel>
      {hasRedirects && (
        <SegmentedTabPanel value="redirects">
          <ResponseViewerPanel viewerTab="redirects" {...panelProps} />
        </SegmentedTabPanel>
      )}
      {hasTests && (
        <SegmentedTabPanel value="tests">
          <ResponseViewerPanel viewerTab="tests" {...panelProps} />
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
            <HostedSurface
              pluginId={entry.pluginId}
              contributionId={entry.contributionId}
              kind="responseTabs"
              context={responseTabContext}
              resizeMode="fill"
              className="h-full"
            />
          </SegmentedTabPanel>
        ))}
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <div className="mb-2 flex items-center border-b border-separator p-3 -mx-3 -mt-2">
        <ResponseSummary
          response={response}
          className="w-full"
          onCopy={() => void handleCopy()}
          onExport={() => void handleExport()}
          onClear={onClear != null ? handleClear : undefined}
          onClose={onClose}
          onExpand={canExpand ? handleExpand : undefined}
          expandTabLabel={expandTabLabel}
          canCopyOrExport={canCopyOrExport}
          canClear={canClear}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <SegmentedTabsGroup value={effectiveTab} onChange={setTab} ariaLabel="Response view">
          <div className="mb-4 -mx-3 -mt-2 flex shrink-0 items-center gap-2 border-b border-separator">
            <SegmentedTabs tabs={tabs} className="border-none" />
          </div>

          {usesFillLayout ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3">
              {tabPanels}
            </div>
          ) : (
            <Scrollbars axis="both" className="-mx-3 flex min-h-0 flex-1 flex-col">
              <div className="px-3 pb-3">{tabPanels}</div>
            </Scrollbars>
          )}
        </SegmentedTabsGroup>
      </div>
    </div>
  );
}
