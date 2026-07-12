import { createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import type { SavedRequest } from '#/shared/types';
import type { TabGroup, TabGroupExport, TabGroupRequest } from '#/shared/types/tabGroup';
import { isRequestTab, type Tab } from '#/renderer/src/store/drafts';
import { loadRequest, setActiveTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  reorderTabGroupsLocal,
  setTabGroups,
  selectTabGroups,
  startEditingTabGroup,
  stopEditingTabGroup,
  selectEditingTabGroupId,
  selectEditSessionHiddenTabIds
} from '#/renderer/src/store/slices/tabGroupSlice';
import { openTabGroupModal } from '#/renderer/src/store/slices/modalsSlice';
import { refreshRequests } from '#/renderer/src/store/thunks/collections';
import { patchGeneralSettings } from '#/renderer/src/store/thunks/settings';
import type { AppDispatch, ThunkApiConfig } from '#/renderer/src/store/redux';
import { showConfirm } from '#/renderer/src/ui/modals/dialogHelpers';

/**
 * Finds a saved request by uuid, preferring the stored collection id when present.
 *
 * @param requestsByCollection - Cached requests keyed by collection id.
 * @param member - Tab group member reference.
 * @returns Matching saved request, if any.
 */
function findSavedRequestByUuid(
  requestsByCollection: Record<number, SavedRequest[]>,
  member: TabGroupRequest
): SavedRequest | undefined {
  if (member.collectionId != null) {
    return (requestsByCollection[member.collectionId] ?? []).find(
      (request) => request.uuid === member.requestUuid
    );
  }

  for (const requests of Object.values(requestsByCollection)) {
    const match = requests.find((request) => request.uuid === member.requestUuid);
    if (match) {
      return match;
    }
  }

  return undefined;
}

/**
 * Returns whether a tab is an open saved collection request.
 *
 * @param tab - Open editor tab to evaluate.
 * @returns True when the tab is a saved request with a collection id.
 */
export function isOpenSavedRequestTab(
  tab: Tab
): tab is Tab & { draft: { id: number; collection_id: number } } {
  return isRequestTab(tab) && tab.draft.id != null && tab.draft.collection_id != null;
}

/**
 * Resolves the saved request uuid for an open saved request tab.
 *
 * @param tab - Open editor tab to evaluate.
 * @param requestsByCollection - Cached saved requests keyed by collection id.
 * @returns Request uuid when the tab references a saved request.
 */
function resolveOpenTabRequestUuid(
  tab: Tab,
  requestsByCollection: Record<number, SavedRequest[]>
): string | undefined {
  if (!isOpenSavedRequestTab(tab)) {
    return undefined;
  }

  const saved = (requestsByCollection[tab.draft.collection_id] ?? []).find(
    (request) => request.id === tab.draft.id
  );
  return saved?.uuid;
}

/**
 * Resolves tab group members from all open saved request tabs.
 *
 * @param tabs - Open editor tabs in display order.
 * @param requestsByCollection - Cached saved requests keyed by collection id.
 * @returns Ordered tab group members for persistence, deduped by request uuid.
 */
export function resolveTabGroupMembersFromOpenTabs(
  tabs: Tab[],
  requestsByCollection: Record<number, SavedRequest[]>
): TabGroupRequest[] {
  const members: TabGroupRequest[] = [];
  const seenUuids = new Set<string>();

  for (const tab of tabs) {
    if (!isOpenSavedRequestTab(tab)) {
      continue;
    }

    const collectionId = tab.draft.collection_id;
    const requestId = tab.draft.id;
    const saved = (requestsByCollection[collectionId] ?? []).find(
      (request) => request.id === requestId
    );
    if (!saved || seenUuids.has(saved.uuid)) {
      continue;
    }

    seenUuids.add(saved.uuid);
    members.push({
      requestUuid: saved.uuid,
      collectionId,
      requestName: saved.name
    });
  }

  return members;
}

/**
 * Refreshes the tab group list from the local registry.
 */
export const refreshTabGroups = createAsyncThunk<void, void, ThunkApiConfig>(
  'tabGroups/refresh',
  async (_arg, { dispatch }) => {
    const items = await window.api.listTabGroups();
    dispatch(setTabGroups(items));
  }
);

/**
 * Prompts before opening the create tab group modal, then opens it when confirmed.
 */
export const requestCreateTabGroupFromOpenTabs = createAsyncThunk<void, void, ThunkApiConfig>(
  'tabGroups/requestCreateFromOpenTabs',
  async (_arg, { dispatch, getState }) => {
    const warnWhenCreatingTabGroup = getState().settings.general.warnWhenCreatingTabGroup;

    if (warnWhenCreatingTabGroup) {
      const result = await showConfirm(dispatch as AppDispatch, {
        title: 'Create tab group?',
        message: 'The tab group will be created from the currently opened request tabs.',
        confirmLabel: 'Create tab group',
        checkboxLabel: "Don't show this again"
      });
      if (!result.confirmed) {
        return;
      }
      if (result.checkboxChecked) {
        await dispatch(patchGeneralSettings({ warnWhenCreatingTabGroup: false }));
      }
    }

    dispatch(openTabGroupModal({ mode: 'create' }));
  }
);

/**
 * Builds tab group members from saved requests in caller order.
 *
 * @param requests - Saved requests to include in the tab group.
 * @returns Ordered tab group members for persistence, deduped by request uuid.
 */
export function resolveTabGroupMembersFromRequests(requests: SavedRequest[]): TabGroupRequest[] {
  const members: TabGroupRequest[] = [];
  const seenUuids = new Set<string>();

  for (const request of requests) {
    if (seenUuids.has(request.uuid)) {
      continue;
    }
    seenUuids.add(request.uuid);
    members.push({
      requestUuid: request.uuid,
      collectionId: request.collection_id,
      requestName: request.name
    });
  }

  return members;
}

/**
 * Creates a tab group from all open saved request tabs.
 */
export const createTabGroupFromOpenTabs = createAsyncThunk<void, string, ThunkApiConfig>(
  'tabGroups/createFromOpenTabs',
  async (name, { dispatch, getState }) => {
    const state = getState();
    const tabs = state.tabs.tabs;
    const requestsByCollection = state.collections.requestsByCollection;

    const collectionsToRefresh = new Set<number>();
    for (const tab of tabs) {
      if (!isOpenSavedRequestTab(tab)) {
        continue;
      }
      const collectionId = tab.draft.collection_id;
      if (!requestsByCollection[collectionId]) {
        collectionsToRefresh.add(collectionId);
      }
    }

    for (const collectionId of collectionsToRefresh) {
      await dispatch(refreshRequests(collectionId));
    }

    const members = resolveTabGroupMembersFromOpenTabs(
      tabs,
      getState().collections.requestsByCollection
    );

    if (members.length === 0) {
      throw new Error('No open requests to add');
    }

    const items = await window.api.createTabGroup({ name, requests: members });
    dispatch(setTabGroups(items));
  }
);

/**
 * Creates a tab group from an explicit saved request list.
 */
export const createTabGroupFromRequests = createAsyncThunk<
  void,
  { name: string; requests: SavedRequest[] },
  ThunkApiConfig
>('tabGroups/createFromRequests', async ({ name, requests }, { dispatch }) => {
  const members = resolveTabGroupMembersFromRequests(requests);

  if (members.length === 0) {
    throw new Error('No requests to add');
  }

  const items = await window.api.createTabGroup({ name, requests: members });
  dispatch(setTabGroups(items));
});

/**
 * Renames a tab group and refreshes the cached list.
 */
export const renameTabGroup = createAsyncThunk<void, { id: number; name: string }, ThunkApiConfig>(
  'tabGroups/rename',
  async ({ id, name }, { dispatch }) => {
    const items = await window.api.renameTabGroup(id, name);
    dispatch(setTabGroups(items));
  }
);

/**
 * Clones a tab group under a new name and refreshes the cached list.
 */
export const cloneTabGroup = createAsyncThunk<void, { id: number; name: string }, ThunkApiConfig>(
  'tabGroups/clone',
  async ({ id, name }, { dispatch }) => {
    const items = await window.api.cloneTabGroup(id, name);
    dispatch(setTabGroups(items));
  }
);

/**
 * Deletes a tab group and refreshes the cached list.
 */
export const deleteTabGroup = createAsyncThunk<void, number, ThunkApiConfig>(
  'tabGroups/delete',
  async (id, { dispatch }) => {
    const items = await window.api.deleteTabGroup(id);
    dispatch(setTabGroups(items));
  }
);

/**
 * Persists a new sidebar order for tab groups and refreshes the cached list.
 */
export const reorderTabGroups = createAsyncThunk<void, number[], ThunkApiConfig>(
  'tabGroups/reorder',
  async (orderedTabGroupIds, { dispatch }) => {
    dispatch(reorderTabGroupsLocal(orderedTabGroupIds));
    const items = await window.api.reorderTabGroups(orderedTabGroupIds);
    dispatch(setTabGroups(items));
  }
);

/**
 * Builds a portable tab group export envelope from a group id.
 *
 * @param groupId - Tab group to export.
 * @param groups - Loaded tab groups from the store.
 * @returns Export envelope with request uuids only.
 */
export function buildTabGroupExport(groupId: number, groups: TabGroup[]): TabGroupExport {
  const group = groups.find((entry) => entry.id === groupId);
  if (!group) {
    throw new Error(`Tab group ${groupId} not found`);
  }

  return {
    harborclientVersion: 1,
    harborclientExport: 'tab_group',
    name: group.name,
    requestUuids: group.requests.map((request) => request.requestUuid)
  };
}

/**
 * Exports a tab group to a JSON file via the native save dialog.
 */
export const exportTabGroup = createAsyncThunk<void, number, ThunkApiConfig>(
  'tabGroups/export',
  async (groupId, { getState }) => {
    const envelope = buildTabGroupExport(groupId, selectTabGroups(getState()));
    const result = await window.api.saveTextFile(
      JSON.stringify(envelope, null, 2),
      `${envelope.name}.json`
    );
    if (!result.canceled) {
      toast.success('Tab group exported');
    }
  }
);

/**
 * Prompts before opening a tab group from the sidebar, then opens it when confirmed.
 */
export const requestOpenTabGroup = createAsyncThunk<void, number, ThunkApiConfig>(
  'tabGroups/requestOpen',
  async (groupId, { dispatch, getState }) => {
    const warnWhenOpeningTabGroup = getState().settings.general.warnWhenOpeningTabGroup;

    if (warnWhenOpeningTabGroup) {
      const result = await showConfirm(dispatch as AppDispatch, {
        title: 'Open all tabs in the request editor?',
        message: 'All saved requests in this tab group will be opened.',
        confirmLabel: 'Open',
        checkboxLabel: "Don't show again"
      });
      if (!result.confirmed) {
        return;
      }
      if (result.checkboxChecked) {
        await dispatch(patchGeneralSettings({ warnWhenOpeningTabGroup: false }));
      }
    }

    await dispatch(openTabGroup(groupId));
  }
);

/**
 * Opens every saved request in a tab group without duplicating existing tabs.
 */
export const openTabGroup = createAsyncThunk<void, number, ThunkApiConfig>(
  'tabGroups/open',
  async (groupId, { dispatch, getState }) => {
    const group = selectTabGroups(getState()).find((entry) => entry.id === groupId);
    if (!group) {
      return;
    }

    const collectionsToRefresh = new Set<number>();
    for (const member of group.requests) {
      if (member.collectionId != null) {
        collectionsToRefresh.add(member.collectionId);
      }
    }

    for (const collectionId of collectionsToRefresh) {
      if (!getState().collections.requestsByCollection[collectionId]) {
        await dispatch(refreshRequests(collectionId));
      }
    }

    let firstOpened = false;
    let missingCount = 0;
    const requestsByCollection = getState().collections.requestsByCollection;

    for (const member of group.requests) {
      const saved = findSavedRequestByUuid(requestsByCollection, member);
      if (!saved) {
        missingCount += 1;
        continue;
      }

      dispatch(loadRequest({ req: saved, activate: !firstOpened }));
      if (!firstOpened) {
        firstOpened = true;
      }
    }

    if (missingCount > 0) {
      toast.error(
        missingCount === 1
          ? '1 request in this tab group could not be opened'
          : `${missingCount} requests in this tab group could not be opened`
      );
    }
  }
);

/**
 * Enters tab group edit mode, opening members and hiding unrelated open tabs.
 */
export const editTabGroup = createAsyncThunk<void, number, ThunkApiConfig>(
  'tabGroups/edit',
  async (groupId, { dispatch, getState }) => {
    await dispatch(openTabGroup(groupId));

    const state = getState();
    const group = selectTabGroups(state).find((entry) => entry.id === groupId);
    if (!group) {
      return;
    }

    const memberUuids = new Set(group.requests.map((request) => request.requestUuid));
    const requestsByCollection = state.collections.requestsByCollection;
    const tabs = state.tabs.tabs;
    const hiddenTabIds: string[] = [];

    for (const tab of tabs) {
      const requestUuid = resolveOpenTabRequestUuid(tab, requestsByCollection);
      if (requestUuid == null || !memberUuids.has(requestUuid)) {
        hiddenTabIds.push(tab.tabId);
      }
    }

    dispatch(startEditingTabGroup({ groupId, hiddenTabIds }));

    const activeTabId = state.tabs.activeTabId;
    if (activeTabId != null && hiddenTabIds.includes(activeTabId)) {
      const firstVisibleTab = tabs.find((tab) => !hiddenTabIds.includes(tab.tabId));
      if (firstVisibleTab != null) {
        dispatch(setActiveTab(firstVisibleTab.tabId));
      }
    }
  }
);

/**
 * Persists tab group membership from visible open tabs and exits edit mode.
 */
export const saveTabGroupEdit = createAsyncThunk<void, void, ThunkApiConfig>(
  'tabGroups/saveEdit',
  async (_arg, { dispatch, getState }) => {
    const state = getState();
    const editingTabGroupId = selectEditingTabGroupId(state);
    if (editingTabGroupId == null) {
      return;
    }

    const hiddenTabIds = new Set(selectEditSessionHiddenTabIds(state));
    const visibleTabs = state.tabs.tabs.filter((tab) => !hiddenTabIds.has(tab.tabId));
    const requestsByCollection = state.collections.requestsByCollection;

    const collectionsToRefresh = new Set<number>();
    for (const tab of visibleTabs) {
      if (!isOpenSavedRequestTab(tab)) {
        continue;
      }
      const collectionId = tab.draft.collection_id;
      if (!requestsByCollection[collectionId]) {
        collectionsToRefresh.add(collectionId);
      }
    }

    for (const collectionId of collectionsToRefresh) {
      await dispatch(refreshRequests(collectionId));
    }

    const members = resolveTabGroupMembersFromOpenTabs(
      visibleTabs,
      getState().collections.requestsByCollection
    );

    if (members.length === 0) {
      throw new Error('No open requests to add');
    }

    const items = await window.api.updateTabGroup(editingTabGroupId, members);
    dispatch(setTabGroups(items));
    dispatch(stopEditingTabGroup());
    toast.success('Tab group saved');
  }
);

/**
 * Exits tab group edit mode without persisting changes.
 */
export const cancelTabGroupEdit = createAsyncThunk<void, void, ThunkApiConfig>(
  'tabGroups/cancelEdit',
  async (_arg, { dispatch }) => {
    dispatch(stopEditingTabGroup());
  }
);
