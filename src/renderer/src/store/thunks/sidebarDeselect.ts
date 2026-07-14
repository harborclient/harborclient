import { createAsyncThunk } from '@reduxjs/toolkit';
import { isMarkdownTab, isRequestTab, type Tab } from '#/renderer/src/store/drafts';
import type { ThunkApiConfig } from '#/renderer/src/store/redux';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import { closeRequestTab } from '#/renderer/src/store/thunks/requests';

/**
 * Optional scope for closing sidebar content tabs during Deselect all.
 */
export interface CloseSidebarContentTabsArgs {
  /**
   * When set, only request and markdown tabs belonging to this collection close.
   */
  collectionId?: number;
}

/**
 * Returns whether a tab should close for the given Deselect all scope.
 *
 * @param tab - Open tab to evaluate.
 * @param collectionId - Optional collection id limiting the close scope.
 * @returns True when the tab is in scope for closing.
 */
function shouldCloseSidebarContentTab(tab: Tab, collectionId: number | undefined): boolean {
  if (collectionId == null) {
    return isRequestTab(tab) || isMarkdownTab(tab);
  }

  if (isMarkdownTab(tab)) {
    return tab.collectionId === collectionId;
  }

  if (isRequestTab(tab)) {
    return tab.draft.collection_id === collectionId;
  }

  return false;
}

/**
 * Closes open request and markdown tabs for Deselect all actions.
 *
 * Request tabs use {@link closeRequestTab} so in-flight sends are cancelled first.
 *
 * @param args - Optional collection scope limiting which tabs close.
 */
export const closeSidebarContentTabs = createAsyncThunk<
  void,
  CloseSidebarContentTabsArgs | undefined,
  ThunkApiConfig
>('sidebar/closeContentTabs', async (args, { dispatch, getState }) => {
  const collectionId = args?.collectionId;
  const tabIds = getState()
    .tabs.tabs.filter((tab) => shouldCloseSidebarContentTab(tab, collectionId))
    .map((tab) => tab.tabId);

  for (const tabId of tabIds) {
    const tab = getState().tabs.tabs.find((entry) => entry.tabId === tabId);
    if (tab == null) {
      continue;
    }

    if (isRequestTab(tab)) {
      await dispatch(closeRequestTab(tabId));
      continue;
    }

    if (isMarkdownTab(tab)) {
      dispatch(closeTab(tabId));
    }
  }
});
