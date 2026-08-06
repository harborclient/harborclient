import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  BrowserSecurityState,
  KeyValue,
  CollectionDocument,
  SavedRequest,
  ScriptRef,
  Variable
} from '@harborclient/core/types';
import { defaultAuth, normalizeAuth, type AuthConfig } from '@harborclient/core/auth';
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
  SSE_SESSION_EVENT_MAX,
  type BrowserTab,
  type PageRef,
  type RequestDraft,
  type RequestTab,
  type ScopedSettingsDraft,
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
 * Merges a reopen payload onto an existing page tab without wiping remembered
 * SegmentedTabs sections when the caller omits `focusSection`.
 *
 * Deep links that pass `focusVariableKey` force the Variables section so row
 * focus still lands correctly when settings were left on another tab.
 *
 * @param existing - Page currently open in the matching tab.
 * @param incoming - Page payload from `openPageTab`.
 * @returns Page to store on the tab.
 */
function mergePageOnReopen(existing: PageRef, incoming: PageRef): PageRef {
  if (existing.type !== incoming.type) {
    return withImpliedFocusSection(incoming);
  }

  if (incoming.type === 'collection' && existing.type === 'collection') {
    return withImpliedFocusSection({
      ...incoming,
      focusSection:
        incoming.focusSection ??
        (incoming.focusVariableKey != null ? 'variables' : existing.focusSection)
    });
  }

  if (incoming.type === 'folder' && existing.type === 'folder') {
    return withImpliedFocusSection({
      ...incoming,
      focusSection:
        incoming.focusSection ??
        (incoming.focusVariableKey != null ? 'variables' : existing.focusSection)
    });
  }

  return withImpliedFocusSection(incoming);
}

/**
 * Fills `focusSection` when a variable deep-link implies the Variables tab.
 *
 * @param page - Incoming or merged page reference.
 * @returns Page with an implied focus section when needed.
 */
function withImpliedFocusSection(page: PageRef): PageRef {
  if (
    (page.type === 'collection' || page.type === 'folder') &&
    page.focusSection == null &&
    page.focusVariableKey != null
  ) {
    return { ...page, focusSection: 'variables' };
  }
  return page;
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
 * Picks which tab becomes active after the current active tab is closed.
 *
 * Prefers the closed tab's {@link Tab.linkedTo} opener when it is still open;
 * otherwise selects the neighbor at the same index (or the last remaining tab).
 *
 * @param remaining - Tabs that will stay open.
 * @param closedTab - Tab being closed (must have been active).
 * @param closedIndex - Index of the closed tab in the pre-close list.
 * @returns Tab id to activate.
 */
function nextActiveTabIdAfterClose(remaining: Tab[], closedTab: Tab, closedIndex: number): string {
  const linkedId = closedTab.linkedTo;
  if (linkedId && remaining.some((tab) => tab.tabId === linkedId)) {
    return linkedId;
  }
  return remaining[Math.min(closedIndex, remaining.length - 1)].tabId;
}

/**
 * Closes matching tabs and restores focus to a linked opener or neighbor when
 * the active tab was removed.
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
    const closedTab = state.tabs[closedIndex];
    if (closedTab) {
      state.activeTabId = nextActiveTabIdAfterClose(remaining, closedTab, closedIndex);
    }
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
              savedPostRequestScripts: source.savedPostRequestScripts,
              variables: source.variables,
              savedVariables: source.savedVariables,
              headers: source.headers,
              savedHeaders: source.savedHeaders,
              userAgent: source.userAgent,
              savedUserAgent: source.savedUserAgent,
              auth: source.auth,
              savedAuth: source.savedAuth
            }
          : { url };
      const tab = createBrowserTab(inherited);
      tab.linkedTo = sourceTabId;
      state.tabs.push(tab);
      if (activate) {
        state.activeTabId = tab.tabId;
      }
    },
    /**
     * Opens or focuses a configuration page tab.
     *
     * Records {@link Tab.linkedTo} as the then-active tab so closing the page
     * tab can restore focus to the opener.
     */
    openPageTab(state, action: PayloadAction<PageRef>) {
      const page = withImpliedFocusSection(action.payload);
      const openerId = state.activeTabId;
      const existing = findPageTab(state.tabs, page);
      if (existing && isPageTab(existing)) {
        if (getPageRoute(page.type).replaceOnReopen) {
          existing.page = mergePageOnReopen(existing.page, page);
        }
        if (openerId && openerId !== existing.tabId) {
          existing.linkedTo = openerId;
        }
        state.activeTabId = existing.tabId;
        return;
      }

      const tab = createPageTab(page);
      if (openerId) {
        tab.linkedTo = openerId;
      }
      state.tabs.push(tab);
      state.activeTabId = tab.tabId;
    },
    /**
     * Remembers the active SegmentedTabs section on a collection or folder
     * settings page so remounts after TabBar switches restore the same tab.
     */
    setPageFocusSection(state, action: PayloadAction<{ tabId: string; focusSection: string }>) {
      const { tabId, focusSection } = action.payload;
      const tab = state.tabs.find((entry) => entry.tabId === tabId);
      if (!tab || !isPageTab(tab)) {
        return;
      }
      if (tab.page.type !== 'collection' && tab.page.type !== 'folder') {
        return;
      }
      tab.page = { ...tab.page, focusSection };
    },
    /**
     * Stores unsaved collection/folder settings fields on the open page tab.
     */
    setPageScopedSettingsDraft(
      state,
      action: PayloadAction<{ tabId: string; draft: ScopedSettingsDraft }>
    ) {
      const tab = state.tabs.find((entry) => entry.tabId === action.payload.tabId);
      if (!tab || !isPageTab(tab)) {
        return;
      }
      if (tab.page.type !== 'collection' && tab.page.type !== 'folder') {
        return;
      }
      tab.scopedSettingsDraft = action.payload.draft;
    },
    /**
     * Stores the draft provider connection id on a collection settings page tab.
     */
    setPageConnectionIdDraft(
      state,
      action: PayloadAction<{ tabId: string; connectionId: string }>
    ) {
      const tab = state.tabs.find((entry) => entry.tabId === action.payload.tabId);
      if (!tab || !isPageTab(tab) || tab.page.type !== 'collection') {
        return;
      }
      tab.connectionIdDraft = action.payload.connectionId;
    },
    /**
     * Marks a collection/folder settings page tab as having unsaved edits.
     */
    setPageTabDirty(state, action: PayloadAction<{ tabId: string; dirty: boolean }>) {
      const tab = state.tabs.find((entry) => entry.tabId === action.payload.tabId);
      if (!tab || !isPageTab(tab)) {
        return;
      }
      if (tab.page.type !== 'collection' && tab.page.type !== 'folder') {
        return;
      }
      tab.dirty = action.payload.dirty;
    },
    /**
     * Clears unsaved settings draft state after a successful save or discard.
     */
    clearPageScopedSettingsDraft(state, action: PayloadAction<string>) {
      const tab = state.tabs.find((entry) => entry.tabId === action.payload);
      if (!tab || !isPageTab(tab)) {
        return;
      }
      delete tab.scopedSettingsDraft;
      delete tab.connectionIdDraft;
      tab.dirty = false;
    },
    /**
     * Closes a tab by id, leaving zero tabs open when the last tab is closed.
     *
     * When the closed tab was active, prefers its {@link Tab.linkedTo} opener
     * when still open; otherwise selects a neighbor by index.
     */
    closeTab(state, action: PayloadAction<string>) {
      const tabId = action.payload;
      const index = state.tabs.findIndex((t) => t.tabId === tabId);
      if (index === -1) return;

      const closedTab = state.tabs[index];
      const next = state.tabs.filter((t) => t.tabId !== tabId);
      if (next.length === 0) {
        state.tabs = [];
        state.activeTabId = '';
        return;
      }

      if (state.activeTabId === tabId && closedTab) {
        state.activeTabId = nextActiveTabIdAfterClose(next, closedTab, index);
      }
      state.tabs = next;
    },
    /**
     * Opens or closes the live page settings footer panel for a browser tab.
     */
    setBrowserSettingsPanelOpen(state, action: PayloadAction<{ tabId: string; open: boolean }>) {
      const tab = state.tabs.find((t) => t.tabId === action.payload.tabId);
      if (!tab || !isBrowserTab(tab)) {
        return;
      }
      tab.settingsPanelOpen = action.payload.open;
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
        securityState: BrowserSecurityState;
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
      tab.securityState = action.payload.securityState;
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
     * Replaces draft live-page variables on a browser tab.
     */
    setBrowserVariables(state, action: PayloadAction<{ tabId: string; variables: Variable[] }>) {
      const tab = state.tabs.find((t) => t.tabId === action.payload.tabId);
      if (!tab || !isBrowserTab(tab)) {
        return;
      }
      tab.variables = action.payload.variables;
    },
    /**
     * Replaces draft live-page headers on a browser tab.
     */
    setBrowserHeaders(state, action: PayloadAction<{ tabId: string; headers: KeyValue[] }>) {
      const tab = state.tabs.find((t) => t.tabId === action.payload.tabId);
      if (!tab || !isBrowserTab(tab)) {
        return;
      }
      tab.headers = action.payload.headers;
    },
    /**
     * Replaces draft live-page User-Agent on a browser tab.
     */
    setBrowserUserAgent(state, action: PayloadAction<{ tabId: string; userAgent: string }>) {
      const tab = state.tabs.find((t) => t.tabId === action.payload.tabId);
      if (!tab || !isBrowserTab(tab)) {
        return;
      }
      tab.userAgent = action.payload.userAgent;
    },
    /**
     * Replaces draft live-page authorization on a browser tab.
     */
    setBrowserAuth(state, action: PayloadAction<{ tabId: string; auth: AuthConfig }>) {
      const tab = state.tabs.find((t) => t.tabId === action.payload.tabId);
      if (!tab || !isBrowserTab(tab)) {
        return;
      }
      tab.auth = normalizeAuth(action.payload.auth);
    },
    /**
     * Commits draft live-page settings (scripts, variables, headers, auth) to saved baselines.
     */
    saveBrowserScripts(state, action: PayloadAction<string>) {
      const tab = state.tabs.find((t) => t.tabId === action.payload);
      if (!tab || !isBrowserTab(tab)) {
        return;
      }
      tab.savedScripts = tab.scripts.map((script) => ({ ...script }));
      tab.savedPreRequestScripts = tab.pre_request_scripts.map((script) => ({ ...script }));
      tab.savedPostRequestScripts = tab.post_request_scripts.map((script) => ({ ...script }));
      tab.savedVariables = tab.variables.map((variable) => ({ ...variable }));
      tab.savedHeaders = tab.headers.map((header) => ({ ...header }));
      tab.savedUserAgent = tab.userAgent;
      tab.savedAuth = {
        ...normalizeAuth(tab.auth),
        basic: { ...tab.auth.basic },
        bearer: { ...tab.auth.bearer },
        oauth2: { ...tab.auth.oauth2 }
      };
      tab.savedTitle = tab.settingsName;
      tab.title = tab.settingsName;
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
      // Prefer an unsaved settings rename; otherwise capture the live document title.
      if (tab.settingsName !== tab.savedTitle) {
        tab.savedTitle = tab.settingsName;
        tab.title = tab.settingsName;
      } else {
        tab.savedTitle = tab.title;
        tab.settingsName = tab.title;
      }
      tab.savedFaviconDataUrl = tab.faviconDataUrl;
      tab.savedScripts = tab.scripts.map((script) => ({ ...script }));
      tab.savedPreRequestScripts = tab.pre_request_scripts.map((script) => ({ ...script }));
      tab.savedPostRequestScripts = tab.post_request_scripts.map((script) => ({ ...script }));
      tab.savedVariables = tab.variables.map((variable) => ({ ...variable }));
      tab.savedHeaders = tab.headers.map((header) => ({ ...header }));
      tab.savedUserAgent = tab.userAgent;
      tab.savedAuth = {
        ...normalizeAuth(tab.auth),
        basic: { ...tab.auth.basic },
        bearer: { ...tab.auth.bearer },
        oauth2: { ...tab.auth.oauth2 }
      };
    },
    /**
     * Ensures a browser tab hydrated from a saved website entity exists.
     *
     * When {@link activate} is true (default), the tab becomes active so the
     * live page opens in the editor. Pass `activate: false` for settings-only
     * flows that need a draft host without switching the editor.
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
        variables?: Variable[];
        headers?: KeyValue[];
        userAgent?: string;
        auth?: AuthConfig;
        /**
         * When false, create or reuse the tab without selecting it.
         */
        activate?: boolean;
      }>
    ) {
      const activate = action.payload.activate !== false;
      const existing = state.tabs.find(
        (t) => isBrowserTab(t) && t.websiteId === action.payload.websiteId
      );
      if (existing && isBrowserTab(existing)) {
        if (activate) {
          state.activeTabId = existing.tabId;
        }
        return;
      }

      const scripts = action.payload.scripts.map((script) => ({ ...script }));
      const pre = action.payload.pre_request_scripts.map((script) => ({ ...script }));
      const post = action.payload.post_request_scripts.map((script) => ({ ...script }));
      const variables = (action.payload.variables ?? []).map((variable) => ({ ...variable }));
      const headers = (action.payload.headers ?? []).map((header) => ({ ...header }));
      const auth = normalizeAuth(action.payload.auth ?? defaultAuth());
      const userAgent = action.payload.userAgent ?? '';
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
        variables,
        savedVariables: variables.map((variable) => ({ ...variable })),
        headers,
        savedHeaders: headers.map((header) => ({ ...header })),
        userAgent,
        savedUserAgent: userAgent,
        auth,
        savedAuth: {
          ...auth,
          basic: { ...auth.basic },
          bearer: { ...auth.bearer },
          oauth2: { ...auth.oauth2 }
        },
        websiteId: action.payload.websiteId,
        websiteUuid: action.payload.websiteUuid,
        savedUrl: action.payload.url,
        savedHomeUrl: action.payload.homeUrl,
        savedTitle: action.payload.title,
        savedFaviconDataUrl: action.payload.faviconDataUrl
      });
      state.tabs.push(tab);
      if (activate) {
        state.activeTabId = tab.tabId;
      }
    },
    /**
     * Discards draft live-page settings and restores the last saved baselines.
     */
    discardBrowserScripts(state, action: PayloadAction<string>) {
      const tab = state.tabs.find((t) => t.tabId === action.payload);
      if (!tab || !isBrowserTab(tab)) {
        return;
      }
      tab.scripts = tab.savedScripts.map((script) => ({ ...script }));
      tab.pre_request_scripts = tab.savedPreRequestScripts.map((script) => ({ ...script }));
      tab.post_request_scripts = tab.savedPostRequestScripts.map((script) => ({ ...script }));
      tab.variables = tab.savedVariables.map((variable) => ({ ...variable }));
      tab.headers = tab.savedHeaders.map((header) => ({ ...header }));
      tab.userAgent = tab.savedUserAgent;
      tab.auth = {
        ...normalizeAuth(tab.savedAuth),
        basic: { ...tab.savedAuth.basic },
        bearer: { ...tab.savedAuth.bearer },
        oauth2: { ...tab.savedAuth.oauth2 }
      };
      tab.settingsName = tab.savedTitle;
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
     * Updates SSE session lifecycle fields on a request tab.
     *
     * Retained events and dropped counts from {@link appendSseEvents} are preserved
     * when a session already exists, so status pushes cannot clobber a fresher
     * event list with a stale snapshot.
     */
    setSseSessionState(
      state,
      action: PayloadAction<{ tabId: string; sseSession: import('../tabs').SseSessionState | null }>
    ) {
      const { tabId, sseSession } = action.payload;
      const requestTab = state.tabs.find((t) => t.tabId === tabId);
      if (!requestTab || !isRequestTab(requestTab)) {
        return;
      }
      if (sseSession == null) {
        requestTab.sseSession = null;
        return;
      }
      const previous = requestTab.sseSession;
      if (previous == null) {
        requestTab.sseSession = sseSession;
        return;
      }
      requestTab.sseSession = {
        ...sseSession,
        events: previous.events,
        droppedCount: previous.droppedCount,
        openedAt: previous.openedAt ?? sseSession.openedAt
      };
    },
    /**
     * Appends SSE events to a tab's session, trimming to the ring-buffer cap.
     */
    appendSseEvents(
      state,
      action: PayloadAction<{
        tabId: string;
        events: import('@harborclient/core/types').SseEvent[];
      }>
    ) {
      const { tabId, events } = action.payload;
      const requestTab = state.tabs.find((t) => t.tabId === tabId);
      if (
        !requestTab ||
        !isRequestTab(requestTab) ||
        !requestTab.sseSession ||
        events.length === 0
      ) {
        return;
      }
      const session = requestTab.sseSession;
      const next = session.events.concat(events);
      const overflow = Math.max(0, next.length - SSE_SESSION_EVENT_MAX);
      session.events = overflow > 0 ? next.slice(overflow) : next;
      session.droppedCount += overflow;
    },
    /**
     * Clears retained SSE events on a tab without closing the connection.
     */
    clearSseEvents(state, action: PayloadAction<{ tabId: string }>) {
      const requestTab = state.tabs.find((t) => t.tabId === action.payload.tabId);
      if (requestTab && isRequestTab(requestTab) && requestTab.sseSession) {
        requestTab.sseSession.events = [];
        requestTab.sseSession.droppedCount = 0;
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
  setPageFocusSection,
  setPageScopedSettingsDraft,
  setPageConnectionIdDraft,
  setPageTabDirty,
  clearPageScopedSettingsDraft,
  closeTab,
  setBrowserSettingsPanelOpen,
  updateBrowserNavigation,
  setBrowserScripts,
  setBrowserPreRequestScripts,
  setBrowserPostRequestScripts,
  setBrowserVariables,
  setBrowserHeaders,
  setBrowserUserAgent,
  setBrowserAuth,
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
  setSseSessionState,
  appendSseEvents,
  clearSseEvents,
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
