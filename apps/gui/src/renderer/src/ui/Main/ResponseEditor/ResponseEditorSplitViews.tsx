import type { ResponseTabContext } from '@harborclient/core/plugin/types';
import {
  DEFAULT_RESPONSE_EDITOR_SPLIT_SIZE,
  MIN_RESPONSE_EDITOR_SPLIT_SIZE,
  type ResponseEditorSplitState,
  type ScriptExecutionEvent,
  type ScriptLogEntry,
  type ScriptRunError,
  type ScriptTestResult,
  type SendResult
} from '@harborclient/core/types';
import {
  ResizeHandle,
  TabContextMenu,
  useResizable,
  type MenuItem,
  type TabItem
} from '@harborclient/sdk/components';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
  type MouseEvent
} from 'react';
import {
  buildDevInspectMenuGroups,
  useDeveloperToolsEnabled
} from '#/renderer/src/ui/Shared/devInspectContextMenu';
import { ResponseEditorPane } from './ResponseEditorPane';
import { ResponseEditorTabPanels } from './ResponseEditorTabPanels';
import {
  buildResponseEditorSplitMenuActions,
  isHorizontalResponseSplit,
  moveTabToSecondarySplit,
  paneUsesFillLayout,
  partitionResponseTabs,
  resolvePaneActiveTab,
  responseEditorSplitMenuLabel,
  unsplitResponseTab,
  type ResponseEditorPaneKind
} from './responseEditorSplit';

/**
 * Menu id used only as a fallback inspect target when click coordinates are missing.
 */
const RESPONSE_TAB_INSPECT_MENU_ID = 'response-editor-tab';

interface PluginTabEntry {
  id: string;
  pluginId: string;
  contributionId: string;
}

interface ContextMenuState {
  pane: ResponseEditorPaneKind;
  tabValue: string;
  x: number;
  y: number;
}

interface Props {
  /**
   * Available response viewer tabs for the current response.
   */
  tabs: TabItem<string>[];

  /**
   * Persisted global split layout, or null when unsplit.
   */
  split: ResponseEditorSplitState | null;

  /**
   * Called when the split layout changes (create, move, unsplit, resize).
   */
  onSplitChange: (next: ResponseEditorSplitState | null) => void;

  /**
   * Active tab in the primary pane.
   */
  primaryTab: string;

  /**
   * Called when the primary pane selection changes.
   */
  onPrimaryTabChange: (tab: string) => void;

  /**
   * Called when either pane becomes the focus target for Expand.
   */
  onFocusedPaneChange: (pane: ResponseEditorPaneKind) => void;

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
   */
  scriptLogs: ScriptLogEntry[];

  /**
   * Ordered variable and flow-control activity from scripts.
   */
  executionEvents: ScriptExecutionEvent[];

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
 * Renders the response editor tab panes, including an optional resizable secondary split.
 */
export function ResponseEditorSplitViews({
  tabs,
  split,
  onSplitChange,
  primaryTab,
  onPrimaryTabChange,
  onFocusedPaneChange,
  response,
  requestUrl,
  testResults,
  scriptLogs,
  executionEvents,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const developerToolsEnabled = useDeveloperToolsEnabled();

  /**
   * Partitions the available tabs into primary and secondary strips.
   */
  const { primary, secondary } = useMemo(
    () => partitionResponseTabs(tabs, split?.secondaryTabIds),
    [split?.secondaryTabIds, tabs]
  );

  /**
   * Plugin tab ids used to decide fill-height layout per pane.
   */
  const pluginTabIds = useMemo(() => new Set(pluginTabs.map((entry) => entry.id)), [pluginTabs]);

  /**
   * Active tab for the secondary pane, remapped when unavailable.
   */
  const secondaryTab = useMemo(
    () =>
      resolvePaneActiveTab(
        split?.activeTab,
        secondary.map((tab) => tab.value),
        secondary[0]?.value ?? primaryTab
      ),
    [primaryTab, secondary, split?.activeTab]
  );

  /**
   * Active tab for the primary pane, remapped when the stored tab moved to secondary.
   */
  const resolvedPrimaryTab = useMemo(
    () =>
      resolvePaneActiveTab(
        primaryTab,
        primary.map((tab) => tab.value),
        primary[0]?.value ?? 'body'
      ),
    [primary, primaryTab]
  );

  /**
   * Keeps primary selection valid when tabs move into the secondary pane.
   */
  useEffect(() => {
    if (resolvedPrimaryTab !== primaryTab) {
      onPrimaryTabChange(resolvedPrimaryTab);
    }
  }, [onPrimaryTabChange, primaryTab, resolvedPrimaryTab]);

  /**
   * Keeps secondary activeTab in sync when remapped to an available tab.
   */
  useEffect(() => {
    if (split == null || secondary.length === 0) {
      return;
    }
    if (split.activeTab !== secondaryTab) {
      onSplitChange({ ...split, activeTab: secondaryTab });
    }
  }, [onSplitChange, secondary.length, secondaryTab, split]);

  /**
   * Reads the split container size so max clamping tracks the live layout.
   */
  const getMaxSplitSize = useCallback((): number => {
    const el = containerRef.current;
    if (el == null) {
      return 600;
    }
    const horizontal = split != null && isHorizontalResponseSplit(split.side);
    const total = horizontal ? el.clientWidth : el.clientHeight;
    return Math.max(MIN_RESPONSE_EDITOR_SPLIT_SIZE, total - MIN_RESPONSE_EDITOR_SPLIT_SIZE - 8);
  }, [split]);

  /**
   * Persists a committed secondary pane size into the global split state.
   */
  const handleSplitSizePersist = useCallback(
    (size: number): void => {
      if (split == null) {
        return;
      }
      onSplitChange({ ...split, size });
    },
    [onSplitChange, split]
  );

  const horizontal = split != null && isHorizontalResponseSplit(split.side);

  const {
    size: secondarySize,
    minSize,
    maxSize,
    setSize,
    onResizeStart,
    onKeyboardResize
  } = useResizable({
    axis: horizontal ? 'x' : 'y',
    // Secondary pane sits left/above the handle for left/up (grow with +delta);
    // right/down put secondary on the far side, so grow with -delta.
    direction: split != null && (split.side === 'right' || split.side === 'down') ? -1 : 1,
    defaultSize: split?.size ?? DEFAULT_RESPONSE_EDITOR_SPLIT_SIZE,
    minSize: MIN_RESPONSE_EDITOR_SPLIT_SIZE,
    getMaxSize: getMaxSplitSize,
    onPersist: handleSplitSizePersist
  });

  /**
   * Applies the persisted secondary pane size when split state hydrates or changes.
   */
  useEffect(() => {
    if (split?.size != null) {
      setSize(split.size);
    }
  }, [setSize, split?.size]);

  /**
   * Updates the secondary pane active tab and marks it focused for Expand.
   *
   * @param nextTab - Tab selected in the secondary pane.
   */
  const handleSecondaryTabChange = (nextTab: string): void => {
    onFocusedPaneChange('secondary');
    if (split == null) {
      return;
    }
    onSplitChange({ ...split, activeTab: nextTab });
  };

  /**
   * Updates the primary pane active tab and marks it focused for Expand.
   *
   * @param nextTab - Tab selected in the primary pane.
   */
  const handlePrimaryTabChange = (nextTab: string): void => {
    onFocusedPaneChange('primary');
    onPrimaryTabChange(nextTab);
  };

  /**
   * Opens the split context menu for a tab in the given pane.
   *
   * @param pane - Pane that owns the clicked tab.
   * @param tabValue - Tab value that was right-clicked.
   * @param event - Mouse event from the tab button.
   */
  const handleTabContextMenu = (
    pane: ResponseEditorPaneKind,
    tabValue: string,
    event: MouseEvent<HTMLButtonElement>
  ): void => {
    setContextMenu({
      pane,
      tabValue,
      x: event.clientX,
      y: event.clientY
    });
  };

  /**
   * Menu actions for the open context menu, if any.
   */
  const contextMenuActions = useMemo(() => {
    if (contextMenu == null) {
      return [];
    }
    const canMove =
      contextMenu.pane === 'secondary' || primary.some((tab) => tab.value !== contextMenu.tabValue);
    return buildResponseEditorSplitMenuActions(contextMenu.pane, split, canMove);
  }, [contextMenu, primary, split]);

  /**
   * Menu items for TabContextMenu: split actions plus Inspect Element in dev mode.
   */
  const contextMenuGroups = useMemo((): MenuItem[][] => {
    if (contextMenu == null) {
      return [];
    }

    const groups: MenuItem[][] = [];
    if (contextMenuActions.length > 0) {
      groups.push(
        contextMenuActions.map((action) => ({
          label: responseEditorSplitMenuLabel(action),
          onSelect: () => {
            const tabValue = contextMenu.tabValue;
            if (action.type === 'unsplit') {
              if (split == null) {
                return;
              }
              const next = unsplitResponseTab(split, tabValue);
              onSplitChange(next);
              onFocusedPaneChange('primary');
              onPrimaryTabChange(tabValue);
              return;
            }
            const next = moveTabToSecondarySplit(
              split,
              tabValue,
              action.side,
              primary.length,
              split?.size ?? DEFAULT_RESPONSE_EDITOR_SPLIT_SIZE
            );
            if (next == null) {
              return;
            }
            onSplitChange(next);
            onFocusedPaneChange('secondary');
            setContextMenu(null);
            if (resolvedPrimaryTab === tabValue) {
              const remaining = primary.filter((tab) => tab.value !== tabValue);
              if (remaining[0]) {
                onPrimaryTabChange(remaining[0].value);
              }
            }
          }
        }))
      );
    }

    for (const group of buildDevInspectMenuGroups(
      { x: contextMenu.x, y: contextMenu.y },
      RESPONSE_TAB_INSPECT_MENU_ID,
      developerToolsEnabled
    )) {
      groups.push(group);
    }

    return groups;
  }, [
    contextMenu,
    contextMenuActions,
    developerToolsEnabled,
    onFocusedPaneChange,
    onPrimaryTabChange,
    onSplitChange,
    primary,
    resolvedPrimaryTab,
    split
  ]);

  /**
   * Shared panel props for both panes.
   */
  const panelCommon = {
    response,
    requestUrl,
    testResults,
    scriptLogs,
    executionEvents,
    scriptError,
    scriptErrors,
    requestTabId,
    requestName,
    showPreviewTab,
    hasRedirects,
    hasTests,
    pluginTabs,
    responseTabContext
  };

  /**
   * Primary pane element shared by unsplit and split layouts.
   */
  const primaryPane = (
    <ResponseEditorPane
      tabs={primary}
      value={resolvedPrimaryTab}
      onChange={handlePrimaryTabChange}
      ariaLabel="Response view"
      editable
      onTabContextMenu={(value, event) => handleTabContextMenu('primary', value, event)}
      usesFillLayout={paneUsesFillLayout(resolvedPrimaryTab, pluginTabIds)}
    >
      <ResponseEditorTabPanels tabIds={new Set(primary.map((tab) => tab.value))} {...panelCommon} />
    </ResponseEditorPane>
  );

  /**
   * Context menu portal shared by unsplit and split layouts.
   */
  const menu =
    contextMenu != null && contextMenuGroups.length > 0 ? (
      <TabContextMenu
        groups={contextMenuGroups}
        position={{ x: contextMenu.x, y: contextMenu.y }}
        onClose={() => setContextMenu(null)}
        ariaLabel="Response tab actions"
      />
    ) : null;

  if (split == null || secondary.length === 0) {
    return (
      <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
        {primaryPane}
        {menu}
      </div>
    );
  }

  const secondaryStyle = horizontal
    ? { width: secondarySize, flex: '0 0 auto' as const }
    : { height: secondarySize, flex: '0 0 auto' as const };

  /**
   * Builds a split pane wrapper with inset padding so tabs/content are not flush
   * against the resize handle or clipped by overflow.
   *
   * @param pane - Pane content to wrap.
   * @param padClass - Tailwind padding class on the side facing the handle.
   * @param sized - When true, applies the secondary pane size style.
   * @returns Wrapped pane element.
   */
  const wrapSplitPane = (pane: JSX.Element, padClass: string, sized: boolean): JSX.Element => {
    return (
      <div
        className={`flex min-h-0 min-w-0 flex-col overflow-hidden ${padClass}${sized ? '' : ' flex-1'}`}
        style={sized ? secondaryStyle : undefined}
      >
        {pane}
      </div>
    );
  };

  const secondaryPane = (
    <ResponseEditorPane
      tabs={secondary}
      value={secondaryTab}
      onChange={handleSecondaryTabChange}
      ariaLabel="Response view secondary"
      editable
      bleedEdges={false}
      onTabContextMenu={(value, event) => handleTabContextMenu('secondary', value, event)}
      usesFillLayout={paneUsesFillLayout(secondaryTab, pluginTabIds)}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <ResponseEditorTabPanels
        tabIds={new Set(secondary.map((tab) => tab.value))}
        {...panelCommon}
      />
    </ResponseEditorPane>
  );

  const splitPrimaryPane = (
    <ResponseEditorPane
      tabs={primary}
      value={resolvedPrimaryTab}
      onChange={handlePrimaryTabChange}
      ariaLabel="Response view"
      editable
      bleedEdges={false}
      onTabContextMenu={(value, event) => handleTabContextMenu('primary', value, event)}
      usesFillLayout={paneUsesFillLayout(resolvedPrimaryTab, pluginTabIds)}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <ResponseEditorTabPanels tabIds={new Set(primary.map((tab) => tab.value))} {...panelCommon} />
    </ResponseEditorPane>
  );

  const handle = (
    <ResizeHandle
      orientation={horizontal ? 'vertical' : 'horizontal'}
      value={secondarySize}
      min={minSize}
      max={maxSize}
      onResizeStart={onResizeStart}
      onKeyboardResize={onKeyboardResize}
      ariaLabel="Resize response editor split"
    />
  );

  let content: JSX.Element;
  switch (split.side) {
    case 'left':
      content = (
        <>
          {wrapSplitPane(secondaryPane, 'pr-3', true)}
          {handle}
          {wrapSplitPane(splitPrimaryPane, 'pl-3', false)}
        </>
      );
      break;
    case 'right':
      content = (
        <>
          {wrapSplitPane(splitPrimaryPane, 'pr-3', false)}
          {handle}
          {wrapSplitPane(secondaryPane, 'pl-3', true)}
        </>
      );
      break;
    case 'up':
      content = (
        <>
          {wrapSplitPane(secondaryPane, 'pb-4', true)}
          {handle}
          {wrapSplitPane(splitPrimaryPane, 'pt-4', false)}
        </>
      );
      break;
    case 'down':
      content = (
        <>
          {wrapSplitPane(splitPrimaryPane, 'pb-4', false)}
          {handle}
          {wrapSplitPane(secondaryPane, 'pt-4', true)}
        </>
      );
      break;
  }

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 flex-1 ${horizontal ? 'flex-row' : 'flex-col'}`}
    >
      {content}
      {menu}
    </div>
  );
}
