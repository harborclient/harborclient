import { HostedSurface } from '#/renderer/src/plugins/HostedSurface';
import type { ResponseTabContext } from '@harborclient/core/plugin/types';
import type {
  ScriptLogEntry,
  ScriptRunError,
  ScriptTestResult,
  SendResult
} from '@harborclient/core/types';
import { SegmentedTabPanel } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { ResponseViewerPanel } from './ResponseViewerPanel';
import type { ResponseViewerTab } from './responseViewerTabs';

interface PluginTabEntry {
  /**
   * Contribution id used as the segmented tab value.
   */
  id: string;

  /**
   * Plugin that owns the contribution.
   */
  pluginId: string;

  /**
   * Manifest contribution id for HostedSurface.
   */
  contributionId: string;
}

interface Props {
  /**
   * Tab values that belong to this pane; other panels are omitted.
   */
  tabIds: Set<string>;

  /**
   * HTTP send result to display.
   */
  response: SendResult;

  /**
   * URL of the active request.
   */
  requestUrl: string;

  /**
   * hc.test results from pre/post scripts.
   */
  testResults: ScriptTestResult[];

  /**
   * Console output captured from scripts.
   * Includes execution traces as debug-level lines.
   */
  scriptLogs: ScriptLogEntry[];

  /**
   * Aggregated script runtime errors from the last send.
   */
  scriptError?: string;

  /**
   * Structured script failures with slot metadata.
   */
  scriptErrors?: ScriptRunError[];

  /**
   * Request tab that owns this response.
   */
  requestTabId?: string;

  /**
   * Display name of the request at capture time.
   */
  requestName?: string;

  /**
   * Whether the Preview tab should appear for HTML or image responses.
   */
  showPreviewTab: boolean;

  /**
   * Whether redirect history exists for this response.
   */
  hasRedirects: boolean;

  /**
   * Whether test results exist for this response.
   */
  hasTests: boolean;

  /**
   * Plugin response tabs eligible for the HTTP response view.
   */
  pluginTabs: PluginTabEntry[];

  /**
   * Read-only plugin tab context shared with contributed tabs.
   */
  responseTabContext: ResponseTabContext;
}

/**
 * Renders built-in and plugin response tab panels filtered to one pane's tab ids.
 */
export function ResponseEditorTabPanels({
  tabIds,
  response,
  requestUrl,
  testResults,
  scriptLogs,
  scriptError,
  scriptErrors,
  requestTabId,
  requestName,
  showPreviewTab,
  hasRedirects,
  hasTests,
  pluginTabs,
  responseTabContext
}: Props): JSX.Element {
  const panelProps = {
    response,
    requestUrl,
    testResults,
    scriptLogs,
    scriptError,
    scriptErrors,
    requestTabId,
    requestName
  };

  /**
   * Renders a built-in viewer panel when its tab id belongs to this pane.
   *
   * @param viewerTab - Built-in response viewer tab id.
   * @param className - Optional panel className.
   * @returns Panel element, or null when the tab is not in this pane.
   */
  function renderBuiltIn(viewerTab: ResponseViewerTab, className?: string): JSX.Element | null {
    if (!tabIds.has(viewerTab)) {
      return null;
    }
    return (
      <SegmentedTabPanel key={viewerTab} value={viewerTab} className={className}>
        <ResponseViewerPanel viewerTab={viewerTab} {...panelProps} />
      </SegmentedTabPanel>
    );
  }

  return (
    <>
      {renderBuiltIn('body')}
      {showPreviewTab ? renderBuiltIn('preview', 'flex min-h-0 flex-1 flex-col') : null}
      {renderBuiltIn('headers')}
      {renderBuiltIn('console')}
      {renderBuiltIn('logs')}
      {renderBuiltIn('timing')}
      {hasRedirects ? renderBuiltIn('redirects') : null}
      {hasTests ? renderBuiltIn('tests') : null}
      {pluginTabs
        .filter((entry) => tabIds.has(entry.id))
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
}
