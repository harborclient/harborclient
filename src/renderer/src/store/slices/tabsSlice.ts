import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SavedRequest } from '#/shared/types';
import {
  cloneDraft,
  createTab,
  draftFromSaved,
  type RequestDraft,
  type RequestTab
} from '#/renderer/src/store/drafts';
import { defaultTabState } from '#/renderer/src/store/persistence';

export interface TabsState {
  tabs: RequestTab[];
  activeTabId: string;
}

const startupTabs = defaultTabState();

const initialState: TabsState = {
  tabs: startupTabs.tabs,
  activeTabId: startupTabs.activeTabId
};

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
     * Replaces the draft on the currently active tab.
     */
    setActiveDraft(state, action: PayloadAction<RequestDraft>) {
      const tab = state.tabs.find((t) => t.tabId === state.activeTabId);
      if (tab) {
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
     * Closes a tab, keeping at least one open.
     */
    closeTab(state, action: PayloadAction<string>) {
      const tabId = action.payload;
      if (state.tabs.length <= 1) {
        const tab = createTab();
        state.tabs = [tab];
        state.activeTabId = tab.tabId;
        return;
      }

      const index = state.tabs.findIndex((t) => t.tabId === tabId);
      if (index === -1) return;

      const next = state.tabs.filter((t) => t.tabId !== tabId);
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
      const existing = state.tabs.find((t) => t.draft.id === req.id);
      if (existing) {
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
      if (tab) {
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
      const matching = state.tabs.filter((t) => t.draft.id === requestId);
      if (matching.length === 0) return;

      const remaining = state.tabs.filter((t) => t.draft.id !== requestId);
      if (remaining.length === 0) {
        const tab = createTab();
        state.tabs = [tab];
        state.activeTabId = tab.tabId;
        return;
      }

      const closedActive = matching.some((t) => t.tabId === state.activeTabId);
      if (closedActive) {
        const closedIndex = state.tabs.findIndex((t) => t.tabId === state.activeTabId);
        const neighbor = remaining[Math.min(closedIndex, remaining.length - 1)];
        state.activeTabId = neighbor.tabId;
      }
      state.tabs = remaining;
    },
    /**
     * Closes every tab belonging to the given collection.
     */
    closeTabsForCollection(state, action: PayloadAction<number>) {
      const collectionId = action.payload;
      const matching = state.tabs.filter((t) => t.draft.collection_id === collectionId);
      if (matching.length === 0) return;

      const remaining = state.tabs.filter((t) => t.draft.collection_id !== collectionId);
      if (remaining.length === 0) {
        const tab = createTab();
        state.tabs = [tab];
        state.activeTabId = tab.tabId;
        return;
      }

      const closedActive = matching.some((t) => t.tabId === state.activeTabId);
      if (closedActive) {
        const closedIndex = state.tabs.findIndex((t) => t.tabId === state.activeTabId);
        const neighbor = remaining[Math.min(closedIndex, remaining.length - 1)];
        state.activeTabId = neighbor.tabId;
      }
      state.tabs = remaining;
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
      if (tab) {
        tab.draft = savedDraft;
        tab.savedDraft = cloneDraft(savedDraft);
      }
    },
    /**
     * Replaces all open tabs after async hydration from electron-store.
     */
    restoreTabsState(state, action: PayloadAction<{ tabs: RequestTab[]; activeTabId: string }>) {
      state.tabs = action.payload.tabs;
      state.activeTabId = action.payload.activeTabId;
    }
  }
});

export const {
  setActiveTab,
  setActiveDraft,
  newTab,
  closeTab,
  loadRequest,
  updateTab,
  openTabWithDraft,
  closeTabsForRequest,
  closeTabsForCollection,
  updateActiveTabDraftAfterSave,
  restoreTabsState
} = tabsSlice.actions;
export default tabsSlice.reducer;
