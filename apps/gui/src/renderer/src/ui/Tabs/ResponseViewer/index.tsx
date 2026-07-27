import { useEffect, type JSX } from 'react';
import { Page } from '@harborclient/sdk/components';
import { faExpand } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import { isRequestTab, type PageRef } from '#/renderer/src/store/tabs';
import { Scrollbars } from '#/renderer/src/ui/Shared/Scrollbars';
import { ResponseViewerPanel } from '#/renderer/src/ui/Main/ResponseEditor/ResponseViewerPanel';
import { RESPONSE_VIEWER_TAB_LABELS } from '#/renderer/src/ui/Main/ResponseEditor/responseViewerTabs';

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
 * Full-page live view of one built-in response viewer sub-tab from a request tab.
 */
export function ResponseViewerPage({ page, tabId }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const tabs = useAppSelector((state) => state.tabs.tabs);
  const requestTab = tabs.find((entry) => entry.tabId === page.requestTabId);
  const linkedRequestTab = requestTab && isRequestTab(requestTab) ? requestTab : null;
  const response = linkedRequestTab?.response ?? null;
  const viewerLabel = RESPONSE_VIEWER_TAB_LABELS[page.viewerTab];
  const usesFillLayout = page.viewerTab === 'preview';

  /**
   * Closes this tab when the source request tab or its response is gone.
   */
  useEffect(() => {
    if (!linkedRequestTab || response == null) {
      dispatch(closeTab(tabId));
    }
  }, [dispatch, linkedRequestTab, response, tabId]);

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
    />
  );

  return (
    <Page
      embedded
      title={page.label}
      description={viewerLabel}
      icon={faExpand}
      className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 pt-0!"
    >
      {usesFillLayout ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{panel}</div>
      ) : (
        <Scrollbars axis="both" className="flex min-h-0 flex-1 flex-col">
          <div className="pb-3">{panel}</div>
        </Scrollbars>
      )}
    </Page>
  );
}
