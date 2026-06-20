import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SavedRequest } from '#/shared/types';
import {
  cloneDraft,
  createTab,
  draftFromSaved,
  type RequestDraft,
  type RequestTab
} from '#/renderer/src/store/drafts';
import { getInitialTabState } from '#/renderer/src/store/persistence';

export interface TabsState {
  tabs: RequestTab[];
  activeTabId: string;
}

const initialState: TabsState = {
  tabs: getInitialTabState().tabs,
  activeTabId: getInitialTabState().activeTabId
};

const tabsSlice = createSlice({
  name: 'tabs',
  initialState,
  reducers: {
    setActiveTab(state, action: PayloadAction<string>) {
      state.activeTabId = action.payload;
    },
    setActiveDraft(state, action: PayloadAction<RequestDraft>) {
      const tab = state.tabs.find((t) => t.tabId === state.activeTabId);
      if (tab) {
        tab.draft = action.payload;
      }
    },
    newTab(state) {
      const tab = createTab();
      state.tabs.push(tab);
      state.activeTabId = tab.tabId;
    },
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
    loadRequest(state, action: PayloadAction<SavedRequest>) {
      const req = action.payload;
      const existing = state.tabs.find((t) => t.draft.id === req.id);
      if (existing) {
        state.activeTabId = existing.tabId;
        return;
      }

      const tab = createTab(draftFromSaved(req));
      state.tabs.push(tab);
      state.activeTabId = tab.tabId;
    },
    updateTab(state, action: PayloadAction<{ tabId: string; updates: Partial<RequestTab> }>) {
      const { tabId, updates } = action.payload;
      const tab = state.tabs.find((t) => t.tabId === tabId);
      if (tab) {
        Object.assign(tab, updates);
      }
    },
    openTabWithDraft(state, action: PayloadAction<RequestDraft>) {
      const tab = createTab(action.payload);
      state.tabs.push(tab);
      state.activeTabId = tab.tabId;
    },
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
  updateActiveTabDraftAfterSave
} = tabsSlice.actions;
export default tabsSlice.reducer;
