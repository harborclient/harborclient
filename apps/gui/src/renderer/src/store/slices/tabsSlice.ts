import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CollectionDocument, SavedRequest, ScriptRef } from '@harborclient/core/types';
import {
  cloneDraft,
  createBrowserTab,
  createMarkdownTab,
  createPageTab,
  createTab,
  draftFromSaved,
  isBrowserTab,
  isMarkdownTab,
  isPageTab,
  isRequestTab,
  isTabDirty,
  pageRefKey,
  pageRefsEqual,
  reconcileMarkdownTab,
  reconcileRequestTab,
  type BrowserTab,
  type PageRef,
  type RequestDraft,
  type RequestTab,
  type Tab
} from '#/renderer/src/store/tabs';
import type { BrowserInjectionScript } from '#/browser/browserScripts';
import { getPageRoute } from '#/renderer/src/store/routing';
import { defaultTabState } from '#/renderer/src/store/persistence';

export interface TabsState {
  tabs: Tab[];
  activeTabId: string;
}

const startupTabs = defaultTabState();

const initialState: TabsState = {
  tabs: startupTabs.tabs,
  activeTabId: startupTabs.activeTabId
};

/**
 * Returns whether a page tab matches the given page reference.
 *
 * @param tab - Candidate tab from the open tab list.
 * @param page - Page reference to match.
 * @returns True when the tab hosts the same page identity.
 */
function pageTabMatches(tab: Tab, page: PageRef): boolean {
  return isPageTab(tab) && pageRefsEqual(tab.page, page);
}

/**
 * Finds an existing page tab for the given page reference.
 *
 * @param tabs - Open tabs to search.
 * @param page - Page reference to find.
 * @returns Matching page tab, if any.
 */
function findPageTab(tabs: Tab[], page: PageRef): Tab | undefined {
  return tabs.find((tab) => pageTabMatches(tab, page));
}

/**
 * Returns whether a tab should be removed when closing tabs for a collection.
 *
 * @param tab - Open tab to evaluate.
 * @param collectionId - Collection id being removed.
 * @returns True when the tab belongs to the collection.
 */
function tabBelongsToCollection(tab: Tab, collectionId: number): boolean {
  if (isMarkdownTab(tab)) {
    return tab.collectionId === collectionId;
  }
  if (isRequestTab(tab)) {
    return tab.draft.collection_id === collectionId;
  }
  if (!isPageTab(tab)) {
    return false;
  }
  if (tab.page.type === 'collection') {
    return tab.page.id === collectionId;
  }
  if (tab.page.type === 'collection-runner') {
    return tab.page.collectionId === collectionId;
  }
  return false;
}

/**
 * Returns whether a tab should be removed when closing tabs for an environment.
 *
 * @param tab - Open tab to evaluate.
 * @param environmentId - Environment id being removed.
 * @returns True when the tab belongs to the environment.
 */
function tabBelongsToEnvironment(tab: Tab, environmentId: number): boolean {
  return isPageTab(tab) && tab.page.type === 'environment' && tab.page.id === environmentId;
}

/**
 * Returns whether a tab is a request or markdown tab belonging to a collection.
 *
 * @param tab - Open tab to evaluate.
 * @param collectionId - Collection id to match.
 * @returns True when the tab is collection-scoped sidebar content.
 */
function isRequestOrMarkdownTabInCollection(tab: Tab, collectionId: number): boolean {
  if (isMarkdownTab(tab)) {
    return tab.collectionId === collectionId;
  }
  if (isRequestTab(tab)) {
    return tab.draft.collection_id === collectionId;
  }
  return false;
}

/**
 * Closes matching tabs and selects a neighbor when the active tab was removed.
 *
 * @param state - Mutable tabs slice state.
 * @param matching - Tabs slated for removal.
 */
function closeMatchingTabs(state: TabsState, matching: Tab[]): void {
  if (matching.length === 0) {
    return;
  }

  const matchingIds = new Set(matching.map((tab) => tab.tabId));
  const remaining = state.tabs.filter((tab) => !matchingIds.has(tab.tabId));

  if (remaining.length === 0) {
    state.tabs = [];
    state.activeTabId = '';
    return;
  }

  const closedActive = matching.some((tab) => tab.tabId === state.activeTabId);
  if (closedActive) {
    const closedIndex = state.tabs.findIndex((tab) => tab.tabId === state.activeTabId);
    const neighbor = remaining[Math.min(closedIndex, remaining.length - 1)];
    state.activeTabId = neighbor.tabId;
  }

  state.tabs = remaining;
}

const tabsSlice = createSlice({
  name: 'tabs',
  initialState,
  reducers: {
    /**
     * Switches the active request editor tab.
     */
    setActiveTab(state, action: PayloadAction<string>) {
      state.activeTabId = action.payload;
    },
    /**
     * Activates the next open request tab, wrapping to the first tab at the end.
     */
    activateNextTab(state) {
      if (state.tabs.length <= 1) {
        return;
      }

      const activeIndex = state.tabs.findIndex((tab) => tab.tabId === state.activeTabId);
      if (activeIndex === -1) {
        return;
      }

      const nextIndex = (activeIndex + 1) % state.tabs.length;
      state.activeTabId = state.tabs[nextIndex]?.tabId ?? state.activeTabId;
    },
    /**
     * Activates the previous open request tab, wrapping to the last tab at the start.
     */
    activatePreviousTab(state) {
      if (state.tabs.length <= 1) {
        return;
      }

      const activeIndex = state.tabs.findIndex((tab) => tab.tabId === state.activeTabId);
      if (activeIndex === -1) {
        return;
      }

      const previousIndex = (activeIndex - 1 + state.tabs.length) % state.tabs.length;
      state.activeTabId = state.tabs[previousIndex]?.tabId ?? state.activeTabId;
    },
    /**
     * Replaces the draft on the currently active tab.
     */
    setActiveDraft(state, action: PayloadAction<RequestDraft>) {
      const tab = state.tabs.find((t) => t.tabId === state.activeTabId);
      if (tab && isRequestTab(tab)) {
        tab.draft = action.payload;
      }
    },
    /**
     * Opens a blank request tab and selects it.
     */
    newTab(state) {
      const tab = createTab();
      state.tabs.push(tab);
      state.activeTabId = tab.tabId;
    },
    /**
     * Opens a new embedded browser tab and selects it.
     *
     * Optional payload lets workflow playback recreate a recorded tab id / URLs.
     */
    newBrowserTab: {
      /**
       * Pushes a browser tab and selects it.
       *
       * @param state - Tabs slice draft.
       * @param action - Optional tabId / url / homeUrl for playback.
       */
      reducer(
        state,
        action: PayloadAction<{ tabId?: string; url?: string; homeUrl?: string } | undefined>
      ) {
        const tab = createBrowserTab(action.payload ?? undefined);
        state.tabs.push(tab);
        state.activeTabId = tab.tabId;
      },
      /**
       * Allows `newBrowserTab()` with no args while still accepting an optional init payload.
       *
       * @param init - Optional tab identity and URLs for playback.
       * @returns Action payload (may be undefined).
       */
      prepare(init?: { tabId?: string; url?: string; homeUrl?: string }) {
        return { payload: init };
      }
    },
    /**
     * Records address-bar navigation intent for workflow recording (IPC runs in the UI).
     */
    browserNavigate: {
      /**
       * No-op reducer; guest load is performed by BrowserTabContent / playback.
       */
      reducer() {
        // Intent-only action for the workflow recorder.
      },
      /**
       * @param payload - Tab and target URL.
       * @returns Action payload.
       */
      prepare(payload: { tabId: string; url: string }) {
        return { payload };
      }
    },
    /**
     * Records back-button intent for workflow recording (IPC runs in the UI).
     */
    browserGoBack: {
      /**
       * No-op reducer; guest history is performed by BrowserTabContent / playback.
       */
      reducer() {
        // Intent-only action for the workflow recorder.
      },
      /**
       * @param payload - Browser tab id.
       * @returns Action payload.
       */
      prepare(payload: { tabId: string }) {
        return { payload };
      }
    },
    /**
     * Records forward-button intent for workflow recording (IPC runs in the UI).
     */
    browserGoForward: {
      /**
       * No-op reducer; guest history is performed by BrowserTabContent / playback.
       */
      reducer() {
        // Intent-only action for the workflow recorder.
      },
      /**
       * @param payload - Browser tab id.
       * @returns Action payload.
       */
      prepare(payload: { tabId: string }) {
        return { payload };
      }
    },
    /**
     * Records reload-button intent for workflow recording (IPC runs in the UI).
     */
    browserReload: {
      /**
       * No-op reducer; guest reload is performed by BrowserTabContent / playback.
       */
      reducer() {
        // Intent-only action for the workflow recorder.
      },
      /**
       * @param payload - Browser tab id.
       * @returns Action payload.
       */
      prepare(payload: { tabId: string }) {
        return { payload };
      }
    },
    /**
     * Records home-button intent for workflow recording (IPC runs in the UI).
     */
    browserGoHome: {
      /**
       * No-op reducer; guest home navigation is performed by BrowserTabContent / playback.
       */
      reducer() {
        // Intent-only action for the workflow recorder.
      },
      /**
       * @param payload - Browser tab id.
       * @returns Action payload.
       */
      prepare(payload: { tabId: string }) {
        return { payload };
      }
    },
    /**
     * Opens a browser tab for a guest popup, inheriting home/scripts from the opener.
     *
     * When the opener tab is missing, opens with blank home/scripts and the requested URL.
     * Activates the new tab only when `activate` is true (background-tab disposition stays
     * on the current tab).
     */
    openInheritedBrowserTab(
      state,
      action: PayloadAction<{ url: string; sourceTabId: string; activate: boolean }>
    ) {
      const { url, sourceTabId, activate } = action.payload;
      const source = state.tabs.find((t) => t.tabId === sourceTabId);
      const inherited =
        source && isBrowserTab(source)
          ? {
              url,
              homeUrl: source.homeUrl,
              scripts: source.scripts,
              savedScripts: source.savedScripts,
              pre_request_scripts: source.pre_request_scripts,
              post_request_scripts: source.post_request_scripts,
              savedPreRequestScripts: source.savedPreRequestScripts,
              savedPostRequestScripts: source.savedPostRequestScripts
            }
          : { url };
      const tab = createBrowserTab(inherited);
      state.tabs.push(tab);
      if (activate) {
        state.activeTabId = tab.tabId;
      }
    },
    /**
     * Opens or focuses a configuration page tab.
     */
    openPageTab(state, action: PayloadAction<PageRef>) {
      const page = action.payload;
      const existing = findPageTab(state.tabs, page);
      if (existing && isPageTab(existing)) {
        if (getPageRoute(page.type).replaceOnReopen) {
          existing.page = page;
        }
        state.activeTabId = existing.tabId;
        return;
      }

      const tab = createPageTab(page);
      state.tabs.push(tab);
      state.activeTabId = tab.tabId;
    },
    /**
     * Closes a tab by id, leaving zero tabs open when the last tab is closed.
     * Closing a browser tab also closes its linked browser-settings page tab.
     */
    closeTab(state, action: PayloadAction<string>) {
      const tabId = action.payload;
      const index = state.tabs.findIndex((t) => t.tabId === tabId);
      if (index === -1) return;

      const closing = state.tabs[index];
      const removeIds = new Set<string>([tabId]);
      if (isBrowserTab(closing)) {
        for (const tab of state.tabs) {
          if (
            isPageTab(tab) &&
            tab.page.type === 'browser-settings' &&
            tab.page.browserTabId === tabId
          ) {
            removeIds.add(tab.tabId);
          }
        }
      }

      const next = state.tabs.filter((t) => !removeIds.has(t.tabId));
      if (next.length === 0) {
        state.tabs = [];
        state.activeTabId = '';
        return;
      }

      if (removeIds.has(state.activeTabId)) {
        const neighbor = next[Math.min(index, next.length - 1)];
        state.activeTabId = neighbor.tabId;
      }
      state.tabs = next;
    },
    /**
     * Patches navigation chrome fields on a browser tab from the main process.
     */
    updateBrowserNavigation(
      state,
      action: PayloadAction<{
        tabId: string;
        url: string;
        title: string;
        canGoBack: boolean;
        canGoForward: boolean;
        faviconDataUrl: string | null;
      }>
    ) {
      const tab = state.tabs.find((t) => t.tabId === action.payload.tabId);
      if (!tab || !isBrowserTab(tab)) {
        return;
      }
      tab.url = action.payload.url;
      tab.title = action.payload.title || tab.title;
      tab.canGoBack = action.payload.canGoBack;
      tab.canGoForward = action.payload.canGoForward;
      tab.faviconDataUrl = action.payload.faviconDataUrl;
    },
    /**
     * Replaces the draft injection scripts on a browser tab (unsaved until Save).
     */
    setBrowserScripts(
      state,
      action: PayloadAction<{ tabId: string; scripts: BrowserInjectionScript[] }>
    ) {
      const tab = state.tabs.find((t) => t.tabId === action.payload.tabId);
      if (!tab || !isBrowserTab(tab)) {
        return;
      }
      tab.scripts = action.payload.scripts;
    },
    /**
     * Replaces draft pre-request hc.* scripts on a browser tab.
     */
    setBrowserPreRequestScripts(
      state,
      action: PayloadAction<{ tabId: string; scripts: ScriptRef[] }>
    ) {
      const tab = state.tabs.find((t) => t.tabId === action.payload.tabId);
      if (!tab || !isBrowserTab(tab)) {
        return;
      }
      tab.pre_request_scripts = action.payload.scripts;
    },
    /**
     * Replaces draft post-request hc.* scripts on a browser tab.
     */
    setBrowserPostRequestScripts(
      state,
      action: PayloadAction<{ tabId: string; scripts: ScriptRef[] }>
    ) {
      const tab = state.tabs.find((t) => t.tabId === action.payload.tabId);
      if (!tab || !isBrowserTab(tab)) {
        return;
      }
      tab.post_request_scripts = action.payload.scripts;
    },
    /**
     * Commits draft injection and hc.* scripts to the saved baselines used at runtime.
     */
    saveBrowserScripts(state, action: PayloadAction<string>) {
      const tab = state.tabs.find((t) => t.tabId === action.payload);
      if (!tab || !isBrowserTab(tab)) {
        return;
      }
      tab.savedScripts = tab.scripts.map((script) => ({ ...script }));
      tab.savedPreRequestScripts = tab.pre_request_scripts.map((script) => ({ ...script }));
      tab.savedPostRequestScripts = tab.post_request_scripts.map((script) => ({ ...script }));
    },
    /**
     * Binds a browser tab to a saved website and refreshes saved baselines from current state.
     */
    bindBrowserTabToWebsite(
      state,
      action: PayloadAction<{
        tabId: string;
        websiteId: number;
        websiteUuid: string;
      }>
    ) {
      const tab = state.tabs.find((t) => t.tabId === action.payload.tabId);
      if (!tab || !isBrowserTab(tab)) {
        return;
      }
      tab.websiteId = action.payload.websiteId;
      tab.websiteUuid = action.payload.websiteUuid;
      tab.savedUrl = tab.url;
      tab.savedHomeUrl = tab.homeUrl;
      tab.savedTitle = tab.title;
      tab.savedFaviconDataUrl = tab.faviconDataUrl;
      tab.savedScripts = tab.scripts.map((script) => ({ ...script }));
      tab.savedPreRequestScripts = tab.pre_request_scripts.map((script) => ({ ...script }));
      tab.savedPostRequestScripts = tab.post_request_scripts.map((script) => ({ ...script }));
    },
    /**
     * Opens a browser tab hydrated from a saved website entity and selects it.
     */
    openBrowserTabFromWebsite(
      state,
      action: PayloadAction<{
        websiteId: number;
        websiteUuid: string;
        title: string;
        url: string;
        homeUrl: string;
        faviconDataUrl: string | null;
        scripts: BrowserInjectionScript[];
        pre_request_scripts: ScriptRef[];
        post_request_scripts: ScriptRef[];
      }>
    ) {
      const existing = state.tabs.find(
        (t) => isBrowserTab(t) && t.websiteId === action.payload.websiteId
      );
      if (existing && isBrowserTab(existing)) {
        state.activeTabId = existing.tabId;
        return;
      }

      const scripts = action.payload.scripts.map((script) => ({ ...script }));
      const pre = action.payload.pre_request_scripts.map((script) => ({ ...script }));
      const post = action.payload.post_request_scripts.map((script) => ({ ...script }));
      const tab = createBrowserTab({
        title: action.payload.title,
        url: action.payload.url,
        homeUrl: action.payload.homeUrl,
        faviconDataUrl: action.payload.faviconDataUrl,
        scripts,
        savedScripts: scripts.map((script) => ({ ...script })),
        pre_request_scripts: pre,
        post_request_scripts: post,
        savedPreRequestScripts: pre.map((script) => ({ ...script })),
        savedPostRequestScripts: post.map((script) => ({ ...script })),
        websiteId: action.payload.websiteId,
        websiteUuid: action.payload.websiteUuid,
        savedUrl: action.payload.url,
        savedHomeUrl: action.payload.homeUrl,
        savedTitle: action.payload.title,
        savedFaviconDataUrl: action.payload.faviconDataUrl
      });
      state.tabs.push(tab);
      state.activeTabId = tab.tabId;
    },
    /**
     * Discards draft injection and hc.* script edits and restores the last saved baselines.
     */
    discardBrowserScripts(state, action: PayloadAction<string>) {
      const tab = state.tabs.find((t) => t.tabId === action.payload);
      if (!tab || !isBrowserTab(tab)) {
        return;
      }
      tab.scripts = tab.savedScripts.map((script) => ({ ...script }));
      tab.pre_request_scripts = tab.savedPreRequestScripts.map((script) => ({ ...script }));
      tab.post_request_scripts = tab.savedPostRequestScripts.map((script) => ({ ...script }));
    },
    /**
     * Patches arbitrary browser tab fields (for example homeUrl).
     */
    updateBrowserTab(
      state,
      action: PayloadAction<{ tabId: string; updates: Partial<Omit<BrowserTab, 'tabId' | 'kind'>> }>
    ) {
      const tab = state.tabs.find((t) => t.tabId === action.payload.tabId);
      if (!tab || !isBrowserTab(tab)) {
        return;
      }
      Object.assign(tab, action.payload.updates);
    },
    /**
     * Opens or focuses a markdown document tab, deduped by document id.
     */
    openMarkdownTab(state, action: PayloadAction<{ doc: CollectionDocument; activate?: boolean }>) {
      const { doc, activate = true } = action.payload;
      const existing = state.tabs.find((tab) => isMarkdownTab(tab) && tab.docId === doc.id);
      if (existing && isMarkdownTab(existing)) {
        if (activate) {
          state.activeTabId = existing.tabId;
        }
        return;
      }

      const tab = createMarkdownTab(doc);
      state.tabs.push(tab);
      if (activate) {
        state.activeTabId = tab.tabId;
      }
    },
    /**
     * Reloads a saved markdown document into an existing tab or opens a new one.
     *
     * False-dirty tabs (disk matches the last-saved baseline) are synced from disk so
     * the amber unsaved color clears. Real local edits are preserved when disk content
     * differs from the saved baseline.
     */
    loadDocument(state, action: PayloadAction<{ doc: CollectionDocument; activate?: boolean }>) {
      const { doc, activate = true } = action.payload;
      const existing = state.tabs.find((tab) => isMarkdownTab(tab) && tab.docId === doc.id);
      if (existing && isMarkdownTab(existing)) {
        if (activate) {
          state.activeTabId = existing.tabId;
        }
        if (isTabDirty(existing) && doc.content !== existing.savedContent) {
          return;
        }
        existing.name = doc.name;
        existing.folderId = doc.folder_id;
        existing.content = doc.content;
        existing.savedContent = doc.content;
        return;
      }

      const tab = createMarkdownTab(doc);
      state.tabs.push(tab);
      if (activate) {
        state.activeTabId = tab.tabId;
      }
    },
    /**
     * Aligns open markdown tabs for a collection with documents just loaded from disk.
     *
     * Used after {@link refreshDocuments} so falsely dirty or stale tabs recover without
     * requiring the user to click the sidebar row.
     */
    reconcileMarkdownTabsFromDocuments(
      state,
      action: PayloadAction<{ collectionId: number; documents: CollectionDocument[] }>
    ) {
      const { collectionId, documents } = action.payload;
      const documentsById = new Map(documents.map((doc) => [doc.id, doc]));
      const tabsToClose: Tab[] = [];
      for (const tab of state.tabs) {
        if (!isMarkdownTab(tab) || tab.collectionId !== collectionId) {
          continue;
        }
        const doc = documentsById.get(tab.docId);
        if (doc == null) {
          tabsToClose.push(tab);
          continue;
        }
        const reconciled = reconcileMarkdownTab(tab, doc);
        if (reconciled == null) {
          continue;
        }
        tab.content = reconciled.content;
        tab.savedContent = reconciled.savedContent;
        tab.name = reconciled.name;
        tab.folderId = reconciled.folderId;
      }
      closeMatchingTabs(state, tabsToClose);
    },
    /**
     * Aligns open request tabs for a collection with requests just loaded from disk.
     *
     * Used after {@link refreshRequests} so clean tabs pick up external edits without
     * requiring the user to click the sidebar row. Closes tabs for requests removed on disk.
     */
    reconcileRequestTabsFromRequests(
      state,
      action: PayloadAction<{ collectionId: number; requests: SavedRequest[] }>
    ) {
      const { collectionId, requests } = action.payload;
      const requestsById = new Map(requests.map((req) => [req.id, req]));
      const tabsToClose: Tab[] = [];
      for (const tab of state.tabs) {
        if (!isRequestTab(tab) || tab.draft.collection_id !== collectionId) {
          continue;
        }
        const requestId = tab.draft.id;
        if (requestId == null) {
          continue;
        }
        const req = requestsById.get(requestId);
        if (req == null) {
          tabsToClose.push(tab);
          continue;
        }
        const reconciled = reconcileRequestTab(tab, req);
        if (reconciled == null) {
          continue;
        }
        tab.draft = reconciled.draft;
        tab.savedDraft = reconciled.savedDraft;
        tab.response = reconciled.response;
        tab.testResults = reconciled.testResults;
        tab.scriptLogs = reconciled.scriptLogs;
        tab.executionEvents = reconciled.executionEvents;
        tab.scriptError = reconciled.scriptError;
        tab.scriptErrors = reconciled.scriptErrors;
      }
      closeMatchingTabs(state, tabsToClose);
    },
    /**
     * Updates editable markdown content on a markdown tab.
     */
    updateMarkdownContent(state, action: PayloadAction<{ tabId: string; content: string }>) {
      const { tabId, content } = action.payload;
      const tab = state.tabs.find((entry) => entry.tabId === tabId);
      if (tab && isMarkdownTab(tab)) {
        tab.content = content;
      }
    },
    /**
     * Syncs the saved baseline after a markdown document is persisted.
     */
    markMarkdownSaved(
      state,
      action: PayloadAction<{ tabId: string; content: string; name?: string }>
    ) {
      const { tabId, content, name } = action.payload;
      const tab = state.tabs.find((entry) => entry.tabId === tabId);
      if (tab && isMarkdownTab(tab)) {
        tab.content = content;
        tab.savedContent = content;
        if (name != null) {
          tab.name = name;
        }
      }
    },
    /**
     * Opens a saved request in a tab or focuses an existing tab.
     */
    loadRequest(state, action: PayloadAction<{ req: SavedRequest; activate?: boolean }>) {
      const { req, activate = true } = action.payload;
      const existing = state.tabs.find((t) => isRequestTab(t) && t.draft.id === req.id);
      if (existing && isRequestTab(existing)) {
        if (activate) {
          state.activeTabId = existing.tabId;
        }
        if (isTabDirty(existing)) {
          return;
        }
        const freshDraft = cloneDraft(draftFromSaved(req));
        existing.draft = freshDraft;
        existing.savedDraft = cloneDraft(freshDraft);
        existing.response = null;
        existing.testResults = [];
        existing.scriptLogs = [];
        existing.executionEvents = [];
        existing.scriptError = undefined;
        existing.scriptErrors = undefined;
        return;
      }

      const tab = createTab(draftFromSaved(req));
      state.tabs.push(tab);
      if (activate) {
        state.activeTabId = tab.tabId;
      }
    },
    /**
     * Merges partial updates into a tab by id.
     */
    updateTab(state, action: PayloadAction<{ tabId: string; updates: Partial<RequestTab> }>) {
      const { tabId, updates } = action.payload;
      const tab = state.tabs.find((t) => t.tabId === tabId);
      if (tab && isRequestTab(tab)) {
        Object.assign(tab, updates);
      }
    },
    /**
     * Stores the selected response viewer sub-tab on a request tab.
     *
     * Survives ResponseEditor unmount when a script-editor page tab is opened
     * from a test result.
     */
    setResponseViewerTab(state, action: PayloadAction<{ tabId: string; tab: string }>) {
      const { tabId, tab: viewerTab } = action.payload;
      const requestTab = state.tabs.find((t) => t.tabId === tabId);
      if (requestTab && isRequestTab(requestTab)) {
        requestTab.responseViewerTab = viewerTab;
      }
    },
    /**
     * Opens a tab seeded with the given draft.
     */
    openTabWithDraft(state, action: PayloadAction<RequestDraft>) {
      const tab = createTab(action.payload);
      state.tabs.push(tab);
      state.activeTabId = tab.tabId;
    },
    /**
     * Closes every tab editing the given markdown document id.
     */
    closeTabsForDocument(state, action: PayloadAction<number>) {
      const documentId = action.payload;
      const matching = state.tabs.filter((tab) => isMarkdownTab(tab) && tab.docId === documentId);
      closeMatchingTabs(state, matching);
    },
    /**
     * Closes every tab editing the given saved request id.
     */
    closeTabsForRequest(state, action: PayloadAction<number>) {
      const requestId = action.payload;
      const matching = state.tabs.filter((t) => isRequestTab(t) && t.draft.id === requestId);
      closeMatchingTabs(state, matching);
    },
    /**
     * Closes every tab belonging to the given collection.
     */
    closeTabsForCollection(state, action: PayloadAction<number>) {
      const collectionId = action.payload;
      const matching = state.tabs.filter((tab) => tabBelongsToCollection(tab, collectionId));
      closeMatchingTabs(state, matching);
    },
    /**
     * Closes every tab belonging to the given environment.
     */
    closeTabsForEnvironment(state, action: PayloadAction<number>) {
      const environmentId = action.payload;
      const matching = state.tabs.filter((tab) => tabBelongsToEnvironment(tab, environmentId));
      closeMatchingTabs(state, matching);
    },
    /**
     * Closes every open saved request and markdown document tab.
     */
    closeAllRequestAndMarkdownTabs(state) {
      const matching = state.tabs.filter((tab) => isRequestTab(tab) || isMarkdownTab(tab));
      closeMatchingTabs(state, matching);
    },
    /**
     * Closes saved request and markdown tabs belonging to one collection.
     */
    closeRequestAndMarkdownTabsForCollection(state, action: PayloadAction<number>) {
      const collectionId = action.payload;
      const matching = state.tabs.filter((tab) =>
        isRequestOrMarkdownTabInCollection(tab, collectionId)
      );
      closeMatchingTabs(state, matching);
    },
    /**
     * Syncs saved draft state after persistence.
     */
    updateActiveTabDraftAfterSave(
      state,
      action: PayloadAction<{ tabId: string; savedDraft: RequestDraft }>
    ) {
      const { tabId, savedDraft } = action.payload;
      const tab = state.tabs.find((t) => t.tabId === tabId);
      if (tab && isRequestTab(tab)) {
        tab.draft = savedDraft;
        tab.savedDraft = cloneDraft(savedDraft);
      }
    },
    /**
     * Updates folder placement on every open tab editing the given saved request.
     */
    syncRequestFolderInTabs(
      state,
      action: PayloadAction<{ requestId: number; folderId: number | null }>
    ) {
      const { requestId, folderId } = action.payload;
      for (const tab of state.tabs) {
        if (!isRequestTab(tab) || tab.draft.id !== requestId) {
          continue;
        }
        tab.draft.folder_id = folderId;
        tab.savedDraft.folder_id = folderId;
      }
    },
    /**
     * Replaces all open tabs after async hydration from electron-store.
     */
    restoreTabsState(state, action: PayloadAction<{ tabs: Tab[]; activeTabId: string }>) {
      state.tabs = action.payload.tabs;
      state.activeTabId = action.payload.activeTabId;
    },
    /**
     * Closes page tabs whose reference key matches one of the provided keys.
     */
    closePageTabsByKeys(state, action: PayloadAction<string[]>) {
      const keys = new Set(action.payload);
      const matching = state.tabs.filter((tab) => isPageTab(tab) && keys.has(pageRefKey(tab.page)));
      closeMatchingTabs(state, matching);
    },
    /**
     * Reorders open tabs to match the tab bar display order after drag-and-drop.
     */
    reorderTabs(state, action: PayloadAction<string[]>) {
      const orderedTabIds = action.payload;
      if (orderedTabIds.length !== state.tabs.length) {
        return;
      }

      const tabsById = new Map(state.tabs.map((tab) => [tab.tabId, tab]));
      const reordered = orderedTabIds.map((tabId) => tabsById.get(tabId));
      if (reordered.some((tab) => tab == null)) {
        return;
      }

      state.tabs = reordered as Tab[];
    }
  }
});

export const {
  setActiveTab,
  activateNextTab,
  activatePreviousTab,
  setActiveDraft,
  newTab,
  newBrowserTab,
  browserNavigate,
  browserGoBack,
  browserGoForward,
  browserReload,
  browserGoHome,
  openInheritedBrowserTab,
  openPageTab,
  closeTab,
  updateBrowserNavigation,
  setBrowserScripts,
  setBrowserPreRequestScripts,
  setBrowserPostRequestScripts,
  saveBrowserScripts,
  bindBrowserTabToWebsite,
  openBrowserTabFromWebsite,
  discardBrowserScripts,
  updateBrowserTab,
  loadRequest,
  openMarkdownTab,
  loadDocument,
  reconcileMarkdownTabsFromDocuments,
  reconcileRequestTabsFromRequests,
  updateMarkdownContent,
  markMarkdownSaved,
  updateTab,
  setResponseViewerTab,
  openTabWithDraft,
  closeTabsForRequest,
  closeTabsForDocument,
  closeTabsForCollection,
  closeTabsForEnvironment,
  closeAllRequestAndMarkdownTabs,
  closeRequestAndMarkdownTabsForCollection,
  updateActiveTabDraftAfterSave,
  syncRequestFolderInTabs,
  restoreTabsState,
  closePageTabsByKeys,
  reorderTabs
} = tabsSlice.actions;
export default tabsSlice.reducer;
