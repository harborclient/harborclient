import { useCallback, useEffect, useMemo, useState, type JSX, type ReactNode } from 'react';
import { Page } from '@harborclient/sdk/components';
import type { RequestHistoryEntry } from '@harborclient/core/types/requestHistory';
import { faExpand } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import { isRequestTab, type PageRef } from '#/renderer/src/store/tabs';
import { Scrollbars } from '#/renderer/src/ui/Shared/Scrollbars';
import { ResponseViewerPanel } from '#/renderer/src/ui/Main/ResponseEditor/ResponseViewerPanel';
import { RESPONSE_VIEWER_TAB_LABELS } from '#/renderer/src/ui/Main/ResponseEditor/responseViewerTabs';
import { ResponseViewerDiffActions } from '#/renderer/src/ui/Main/ResponseEditor/ResponseViewerDiffActions';
import { ResponseViewerCopyToChatActions } from '#/renderer/src/ui/Main/ResponseEditor/ResponseViewerCopyToChatActions';
import { ResponseTextDiffPanel } from '#/renderer/src/ui/Main/ResponseEditor/ResponseTextDiffPanel';
import {
  buildResponseDiffContent,
  type ResponseDiffKind,
  type ResponseHistoryMatchTarget
} from '#/renderer/src/ui/Main/ResponseEditor/responseHistoryDiff';
import { isAiResponseSection } from '#/renderer/src/ui/Main/ResponseEditor/responseSectionReference';

interface Props {
  /**
   * Active response-viewer page tab identity.
   */
  page: Extract<PageRef, { type: 'response-viewer' }>;

  /**
   * Tab id hosting this page (used to close stale tabs).
   */
  tabId: string;
}

/**
 * Diff baseline tied to the viewer tab it was selected for.
 */
interface DiffBaselineSelection {
  /**
   * Viewer tab (body or headers) that owns this Diff baseline.
   */
  kind: ResponseDiffKind;

  /**
   * Prior history entry chosen as the Diff baseline.
   */
  entry: RequestHistoryEntry;
}

/**
 * Full-page live view of one built-in response viewer sub-tab from a request tab.
 */
export function ResponseViewerPage({ page, tabId }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector((state) => state.tabs.tabs);
  const requestTab = tabs.find((entry) => entry.tabId === page.requestTabId);
  const linkedRequestTab = requestTab && isRequestTab(requestTab) ? requestTab : null;
  const response = linkedRequestTab?.response ?? null;
  const viewerLabel = RESPONSE_VIEWER_TAB_LABELS[page.viewerTab];
  const showDiff = (page.viewerTab === 'body' || page.viewerTab === 'headers') && response != null;
  const showCopyToChat = isAiResponseSection(page.viewerTab) && response != null;
  const [diffBaseline, setDiffBaseline] = useState<DiffBaselineSelection | null>(null);
  const diffKind: ResponseDiffKind = page.viewerTab === 'headers' ? 'headers' : 'body';

  /**
   * Active baseline only when it was selected for the current Diff kind.
   */
  const diffBaselineEntry =
    diffBaseline != null && diffBaseline.kind === diffKind ? diffBaseline.entry : null;
  const diffActive = diffBaselineEntry != null;
  const usesFillLayout = page.viewerTab === 'preview' || page.viewerTab === 'body' || diffActive;

  /**
   * Match criteria for prior history Diff against this request tab.
   */
  const matchTarget = useMemo((): ResponseHistoryMatchTarget | null => {
    if (linkedRequestTab == null) {
      return null;
    }
    return {
      savedRequestId: linkedRequestTab.draft.id,
      method: linkedRequestTab.draft.method,
      url: linkedRequestTab.draft.url
    };
  }, [linkedRequestTab]);

  /**
   * Formatted previous/current Diff documents for the active baseline.
   */
  const diffContent = useMemo(() => {
    if (response == null || !showDiff) {
      return null;
    }
    return buildResponseDiffContent(diffKind, response, diffBaselineEntry);
  }, [diffBaselineEntry, diffKind, response, showDiff]);

  /**
   * Activates an inline Diff against the chosen history baseline.
   *
   * @param entry - Selected prior history entry.
   */
  const handleDiffBaselineSelected = useCallback(
    (entry: RequestHistoryEntry): void => {
      setDiffBaseline({ kind: diffKind, entry });
    },
    [diffKind]
  );

  /**
   * Clears the inline Diff and restores the normal viewer content.
   */
  const handleCloseDiff = useCallback((): void => {
    setDiffBaseline(null);
  }, []);

  /**
   * Closes this tab when the source request tab or its response is gone.
   */
  useEffect(() => {
    if (!linkedRequestTab || response == null) {
      dispatch(closeTab(tabId));
    }
  }, [dispatch, linkedRequestTab, response, tabId]);

  const requestName = linkedRequestTab?.draft.name || 'Request';

  /**
   * Diff and Copy-to-chat controls for the page header action row.
   */
  const headerActions = useMemo((): ReactNode => {
    if (response == null || linkedRequestTab == null) {
      return undefined;
    }

    const actions: ReactNode[] = [];

    if (showCopyToChat && isAiResponseSection(page.viewerTab)) {
      actions.push(
        <ResponseViewerCopyToChatActions
          key="copy-to-chat"
          section={page.viewerTab}
          requestTabId={page.requestTabId}
          requestName={requestName}
          response={response}
          testResults={linkedRequestTab.testResults}
          scriptLogs={linkedRequestTab.scriptLogs}
          executionEvents={linkedRequestTab.executionEvents}
          scriptError={linkedRequestTab.scriptError}
          scriptErrors={linkedRequestTab.scriptErrors}
        />
      );
    }

    if (showDiff && matchTarget != null) {
      actions.push(
        <ResponseViewerDiffActions
          key="diff"
          kind={diffKind}
          response={response}
          matchTarget={matchTarget}
          diffActive={diffActive}
          onDiffBaselineSelected={handleDiffBaselineSelected}
          onCloseDiff={handleCloseDiff}
        />
      );
    }

    return actions.length > 0 ? actions : undefined;
  }, [
    diffActive,
    diffKind,
    handleCloseDiff,
    handleDiffBaselineSelected,
    linkedRequestTab,
    matchTarget,
    page.requestTabId,
    page.viewerTab,
    requestName,
    response,
    showCopyToChat,
    showDiff
  ]);

  if (!linkedRequestTab || response == null) {
    return <></>;
  }

  const panel = (
    <ResponseViewerPanel
      viewerTab={page.viewerTab}
      response={response}
      requestUrl={linkedRequestTab.draft.url}
      testResults={linkedRequestTab.testResults}
      scriptLogs={linkedRequestTab.scriptLogs}
      executionEvents={linkedRequestTab.executionEvents}
      scriptError={linkedRequestTab.scriptError}
      scriptErrors={linkedRequestTab.scriptErrors}
      requestTabId={page.requestTabId}
      fillHeight={page.viewerTab === 'body'}
    />
  );

  return (
    <Page
      embedded
      title={page.label}
      description={viewerLabel}
      icon={faExpand}
      className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 pt-0!"
      actions={headerActions}
    >
      {diffActive && diffContent != null && diffBaselineEntry != null ? (
        <ResponseTextDiffPanel
          title={diffContent.title}
          previous={diffContent.previous}
          current={diffContent.current}
          language={diffContent.language}
          baselineEntry={diffBaselineEntry}
        />
      ) : usesFillLayout ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{panel}</div>
      ) : (
        <Scrollbars axis="both" className="flex min-h-0 flex-1 flex-col">
          <div className="pb-3">{panel}</div>
        </Scrollbars>
      )}
    </Page>
  );
}
