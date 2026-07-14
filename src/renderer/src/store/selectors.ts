import type { RootState } from '#/renderer/src/store/redux';
import {
  defaultDraft,
  isMarkdownTab,
  isPageTab,
  isRequestTab,
  type MarkdownTab,
  type PageRef,
  type RequestDraft,
  type RequestTab
} from '#/renderer/src/store/drafts';
import type {
  Environment,
  ScriptExecutionEvent,
  ScriptTestResult,
  SendResult,
  Snippet
} from '#/shared/types';

/**
 * Returns all collections.
 */
export const selectCollections = (state: RootState): RootState['collections']['collections'] =>
  state.collections.collections;

/**
 * Returns all saved run result summaries loaded in the store.
 */
export const selectRunResults = (state: RootState): RootState['runResults']['items'] =>
  state.runResults.items;
/**
 * Returns whether the collections list has been loaded at least once.
 */
export const selectCollectionsListed = (state: RootState): boolean =>
  state.collections.collectionsListed;
/**
 * Returns cached requests keyed by collection id.
 */
export const selectRequestsByCollection = (
  state: RootState
): RootState['collections']['requestsByCollection'] => state.collections.requestsByCollection;
/**
 * Returns cached markdown documents keyed by collection id.
 */
export const selectDocumentsByCollection = (
  state: RootState
): RootState['collections']['documentsByCollection'] => state.collections.documentsByCollection;
export const selectActiveDocumentId = (state: RootState): number | undefined => {
  const tab = selectActiveTab(state);
  if (tab && isMarkdownTab(tab)) {
    return tab.docId;
  }
  return undefined;
};

/**
 * Returns ids for every saved request currently open in a tab.
 *
 * @param state - Current Redux root state.
 */
export const selectOpenRequestIds = (state: RootState): ReadonlySet<number> => {
  const ids = new Set<number>();
  for (const tab of state.tabs.tabs) {
    if (isRequestTab(tab) && tab.draft.id != null) {
      ids.add(tab.draft.id);
    }
  }
  return ids;
};

/**
 * Returns ids for every markdown document currently open in a tab.
 *
 * @param state - Current Redux root state.
 */
export const selectOpenDocumentIds = (state: RootState): ReadonlySet<number> => {
  const ids = new Set<number>();
  for (const tab of state.tabs.tabs) {
    if (isMarkdownTab(tab)) {
      ids.add(tab.docId);
    }
  }
  return ids;
};

/**
 * Returns cached folders keyed by collection id.
 */
export const selectFoldersByCollection = (
  state: RootState
): RootState['collections']['foldersByCollection'] => state.collections.foldersByCollection;
/**
 * Returns the sidebar selected collection id.
 */
export const selectSelectedCollectionId = (
  state: RootState
): RootState['collections']['selectedCollectionId'] => state.collections.selectedCollectionId;
/**
 * Returns the sidebar selected folder id.
 */
export const selectSelectedFolderId = (
  state: RootState
): RootState['collections']['selectedFolderId'] => state.collections.selectedFolderId;

/**
 * Returns all environments.
 */
export const selectEnvironments = (state: RootState): Environment[] =>
  state.environments.environments;
/**
 * Returns the active environment id.
 */
export const selectActiveEnvironmentId = (
  state: RootState
): RootState['environments']['activeEnvironmentId'] => state.environments.activeEnvironmentId;

/**
 * Returns all reusable JavaScript snippets.
 */
export const selectSnippets = (state: RootState): Snippet[] => state.snippets.snippets;

/**
 * Returns all open request tabs.
 */
export const selectTabs = (state: RootState): RootState['tabs']['tabs'] => state.tabs.tabs;
/**
 * Returns the active tab id.
 */
export const selectActiveTabId = (state: RootState): RootState['tabs']['activeTabId'] =>
  state.tabs.activeTabId;

/**
 * Returns the active tab object, falling back to the first tab.
 */
export const selectActiveTab = (
  state: RootState
): RootState['tabs']['tabs'][number] | undefined => {
  const tabs = state.tabs.tabs;
  const activeTabId = state.tabs.activeTabId;
  return tabs.find((t) => t.tabId === activeTabId) ?? tabs[0];
};

/**
 * Returns the request tab that AI tools and `@` script references should treat as active.
 *
 * When the focused tab is a popped-out script editor page, follows `page.requestTabId` back to
 * the linked request tab so badges and agent tools still resolve the correct draft.
 *
 * @param state - Current Redux root state.
 */
export const selectEffectiveActiveRequestTab = (state: RootState): RequestTab | undefined => {
  const activeTab = selectActiveTab(state);
  if (activeTab && isRequestTab(activeTab)) {
    return activeTab;
  }

  if (activeTab && isPageTab(activeTab)) {
    const page = activeTab.page;
    if (page.type === 'script-editor') {
      const linkedTab = state.tabs.tabs.find((tab) => tab.tabId === page.requestTabId);
      if (linkedTab && isRequestTab(linkedTab)) {
        return linkedTab;
      }
    }
  }

  return undefined;
};

/**
 * Returns the page reference for the active tab when it hosts a configuration page.
 */
export const selectActivePage = (state: RootState): PageRef | null => {
  const tab = selectActiveTab(state);
  if (tab && isPageTab(tab)) {
    return tab.page;
  }
  return null;
};

/**
 * Returns the active markdown document tab, when the selected tab is a markdown editor.
 */
export const selectActiveMarkdownTab = (state: RootState): MarkdownTab | null => {
  const tab = selectActiveTab(state);
  if (tab && isMarkdownTab(tab)) {
    return tab;
  }
  return null;
};

/**
 * Returns the draft for the active request tab.
 */
export const selectDraft = (state: RootState): RequestDraft => {
  const tab = selectActiveTab(state);
  if (tab && isRequestTab(tab)) {
    return tab.draft;
  }
  return defaultDraft();
};

/**
 * Returns the last send response for the active request tab.
 */
export const selectResponse = (state: RootState): SendResult | null => {
  const tab = selectActiveTab(state);
  if (tab && isRequestTab(tab)) {
    return tab.response;
  }
  return null;
};

/**
 * Returns whether the active request tab is in flight.
 */
export const selectSending = (state: RootState): boolean => {
  const tab = selectActiveTab(state);
  if (tab && isRequestTab(tab)) {
    return tab.sending;
  }
  return false;
};

/**
 * Returns script test results for the active request tab.
 */
export const selectTestResults = (state: RootState): ScriptTestResult[] => {
  const tab = selectActiveTab(state);
  if (tab && isRequestTab(tab)) {
    return tab.testResults;
  }
  return [];
};

/**
 * Returns script console output for the active request tab.
 */
export const selectScriptLogs = (state: RootState): string[] => {
  const tab = selectActiveTab(state);
  if (tab && isRequestTab(tab)) {
    return tab.scriptLogs;
  }
  return [];
};

/**
 * Returns execution activity for the active request tab.
 */
export const selectExecutionEvents = (state: RootState): ScriptExecutionEvent[] => {
  const tab = selectActiveTab(state);
  if (tab && isRequestTab(tab)) {
    return tab.executionEvents;
  }
  return [];
};

/**
 * Returns aggregated script runtime errors for the active request tab.
 */
export const selectScriptError = (state: RootState): string | undefined => {
  const tab = selectActiveTab(state);
  if (tab && isRequestTab(tab)) {
    return tab.scriptError;
  }
  return undefined;
};

/**
 * Returns the next request name from hc.execution.setNextRequest on the active tab.
 */
export const selectScriptNextRequest = (state: RootState): string | null | undefined => {
  const tab = selectActiveTab(state);
  if (tab && isRequestTab(tab)) {
    return tab.scriptNextRequest;
  }
  return undefined;
};

/**
 * Returns whether hc.execution.skipRequest skipped the latest send on the active tab.
 */
export const selectScriptSkipRequest = (state: RootState): boolean => {
  const tab = selectActiveTab(state);
  if (tab && isRequestTab(tab)) {
    return tab.scriptSkipRequest === true;
  }
  return false;
};

/**
 * Returns session console log entries.
 */
export const selectConsoleEntries = (state: RootState): RootState['console']['consoleEntries'] =>
  state.console.consoleEntries;
