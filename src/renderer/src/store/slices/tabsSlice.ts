import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SavedRequest } from '#/shared/types';
import {
  cloneDraft,
  createPageTab,
  createTab,
  draftFromSaved,
  isPageTab,
  isRequestTab,
  pageRefKey,
  pageRefsEqual,
  type PageRef,
  type RequestDraft,
  type RequestTab,
  type Tab
} from '#/renderer/src/store/drafts';
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
  if (isRequestTab(tab)) {
    return tab.draft.collection_id === collectionId;
  }
  return tab.page.type === 'collection' && tab.page.id === collectionId;
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
     * Opens or focuses a configuration page tab.
     */
    openPageTab(state, action: PayloadAction<PageRef>) {
      const page = action.payload;
      const existing = findPageTab(state.tabs, page);
      if (existing && isPageTab(existing)) {
        if (page.type === 'settings') {
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
     */
    closeTab(state, action: PayloadAction<string>) {
      const tabId = action.payload;
      const index = state.tabs.findIndex((t) => t.tabId === tabId);
      if (index === -1) return;

      const next = state.tabs.filter((t) => t.tabId !== tabId);
      if (next.length === 0) {
        state.tabs = [];
        state.activeTabId = '';
        return;
      }

      if (state.activeTabId === tabId) {
        const neighbor = next[Math.min(index, next.length - 1)];
        state.activeTabId = neighbor.tabId;
      }
      state.tabs = next;
    },
    /**
     * Opens a saved request in a tab or focuses an existing tab.
     */
    loadRequest(state, action: PayloadAction<SavedRequest>) {
      const req = action.payload;
      const existing = state.tabs.find((t) => isRequestTab(t) && t.draft.id === req.id);
      if (existing && isRequestTab(existing)) {
        state.activeTabId = existing.tabId;
        const freshDraft = cloneDraft(draftFromSaved(req));
        existing.draft = freshDraft;
        existing.savedDraft = cloneDraft(freshDraft);
        existing.response = null;
        existing.testResults = [];
        return;
      }

      const tab = createTab(draftFromSaved(req));
      state.tabs.push(tab);
      state.activeTabId = tab.tabId;
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
     * Opens a tab seeded with the given draft.
     */
    openTabWithDraft(state, action: PayloadAction<RequestDraft>) {
      const tab = createTab(action.payload);
      state.tabs.push(tab);
      state.activeTabId = tab.tabId;
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
  openPageTab,
  closeTab,
  loadRequest,
  updateTab,
  openTabWithDraft,
  closeTabsForRequest,
  closeTabsForCollection,
  closeTabsForEnvironment,
  updateActiveTabDraftAfterSave,
  restoreTabsState,
  closePageTabsByKeys,
  reorderTabs
} = tabsSlice.actions;
export default tabsSlice.reducer;
